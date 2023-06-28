#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  PersistentStack,
  VpcPersistentStack,
} from '../lib/stacks';

const app = new cdk.App();

const projectName = app.node.tryGetContext("project-name")
if (! projectName) {
  console.error("“project-name” is not specified in cdk.json.")
  process.exit(1)
}

// Deployment environment
const envName = app.node.tryGetContext("env") || "dev"
if (! [
  "dev",
  "stg",
  "prd"
].includes(envName)) {
  console.error(`“${envName}” is not permitted as a deployment environment name.`)
  process.exit(1)
}

// To prevent the reuse of command-line history during production environment deployment
if (envName !== "dev") {
  const SecretKey = "c555c67";
  const otpLib = require("otplib");
  // Valid for 10 minutes
  otpLib.authenticator.options = { step: 60 * 10 };
  // Get the OTP from the context
  const otpInput = app.node.tryGetContext("otp") || "";
  // If no OTP is specified, generate a new OTP and output it
  if (otpInput === "") {
    const otp = otpLib.authenticator.generate(SecretKey);
    console.log(`No OTP specified. Please use the following option: \`--context otp=${otp}\``);
    process.exit(1);
  }
  // Check if the given OTP is valid
  if (! otpLib.authenticator.check(otpInput, SecretKey)) {
    const otp = otpLib.authenticator.generate(SecretKey);
    console.log(`The provided OTP is invalid. Please use the following OTP: \`--context otp=${otp}\``);
    process.exit(1);
  }
}
const stackBaseName = `${envName}-${projectName}`;

const persistentStack = new PersistentStack(app, `${stackBaseName}-persistent`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "This stack is persistent",
  stackBaseName,
  terminationProtection: true,
});

const vpcPersistentStack = new VpcPersistentStack(app, `${stackBaseName}-vpc-persistent`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackBaseName,
  persistentStack,
  description: "This stack is VPC persistent",
  terminationProtection: true,
})
