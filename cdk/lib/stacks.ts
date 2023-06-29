import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import tap = require("lodash/tap");
import {
  aws_ec2 as ec2,
  aws_s3 as s3,
  aws_elasticloadbalancingv2 as elbv2,
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
  public readonly securityGroupAlbX: ec2.SecurityGroup
  public readonly albX: elbv2.ApplicationLoadBalancer
  public readonly listener80: elbv2.ApplicationListener
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

    // ALB
    this.securityGroupAlbX = new ec2.SecurityGroup(this, 'SecurityGroupAlbX', {
      vpc: this.vpcX,
      description: 'Security group ALB',
      securityGroupName: `${props.stackBaseName}-security-group-alb`,
    })
    this.securityGroupAlbX.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
    const albX = this.albX = new elbv2.ApplicationLoadBalancer(this, 'AlbX', {
      vpc: this.vpcX,
      internetFacing: true,
      loadBalancerName: `${props.stackBaseName}-alb-x`,
      securityGroup: this.securityGroupAlbX,
    })
    // Log destination bucket for ALB
    const loggingBucket = new s3.Bucket(this, 'S3BucketAlb', {
      bucketName: `${props.stackBaseName}-alb-x-${this.account}-${this.region}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    albX.logAccessLogs(loggingBucket)
    const listener80 = this.listener80 = new elbv2.ApplicationListener(this, "Listener80", {
      loadBalancer: albX,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/html",
        messageBody: "<html lang='en'><body><H1>404 Not Found</H1></body></html>",
      }),
    })
    listener80.addAction("ActionHello", {
      conditions: [elbv2.ListenerCondition.pathPatterns(["/"])],
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: "text/html",
        messageBody: "<html lang='en'><body><H1>Hello!</H1></body></html>",
      }),
      priority: 1,
    })

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
