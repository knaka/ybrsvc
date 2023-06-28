import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import tap = require("lodash/tap");
import {
  aws_ec2 as ec2,
  aws_s3 as s3,
} from "aws-cdk-lib";
import {readFileSync} from "fs";

interface PersistentStackProps extends cdk.StackProps {
  // Stack name without environment prefix
  stackBaseName: string,
}

// Stack for persistent resources without VPC
export class PersistentStack extends cdk.Stack {
  public readonly keyPairX: ec2.CfnKeyPair
  public readonly bucketX: s3.Bucket

  constructor(scope: Construct, id: string, props: PersistentStackProps) {
    super(scope, id, props);

    // Key-pair
    this.keyPairX = tap(
      new ec2.CfnKeyPair(this, 'KeyPairX', {
        keyName: `${props.stackBaseName}-key-pair-x`,
      }),
      (keyPair) => {
        keyPair.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
      },
    )

    this.bucketX = new s3.Bucket(this, 'BucketX', {
      bucketName: `${props.stackBaseName}-${this.account}-${this.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

interface VpcPersistentStackProps extends cdk.StackProps {
  stackBaseName: string,
  persistentStack: PersistentStack,
}

// Stack for persistent resources with VPC
export class VpcPersistentStack extends cdk.Stack {
  public readonly vpcX: ec2.Vpc
  public readonly securityGroupBastion: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: VpcPersistentStackProps) {
    super(scope, id, props);

    const vpcX = this.vpcX = new ec2.Vpc(this, "VpcX", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${props.stackBaseName}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroupBastion = this.securityGroupBastion = new ec2.SecurityGroup(this, 'SecurityGroupBastion', {
      vpc: vpcX,
      description: 'Security group Bastion',
      securityGroupName: `${props.stackBaseName}-security-group-bastion`,
    })
    tap(
      new ec2.Instance(this, "InstanceBastion", {
        vpc: vpcX,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
          availabilityZones: [vpcX.availabilityZones[0]],
          onePerAz: true,
        },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
        machineImage: ec2.MachineImage.latestAmazonLinux2({
          cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        }),
        keyName: cdk.Token.asString(props.persistentStack.keyPairX.ref),
        ssmSessionPermissions: true,
      }),
      (instance) => {
        instance.addSecurityGroup(securityGroupBastion)
        const script = readFileSync("./lib/resources/user-data-bastion.sh", "utf8");
        instance.addUserData(script)
      },
    )
  }
}
