import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { VPCArgs } from "../utils/types";

/**
 * VPC Component Resource
 * Creates a VPC with configurable DNS settings
 */
export class VPC extends pulumi.ComponentResource {
  public readonly vpc: aws.ec2.Vpc;
  public readonly vpcId: pulumi.Output<string>;

  constructor(
    name: string,
    args: VPCArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:network:VPC", name, {}, opts);

    // Create VPC
    this.vpc = new aws.ec2.Vpc(
      `${name}-vpc`,
      {
        cidrBlock: args.cidrBlock,
        enableDnsHostnames: args.enableDnsHostnames ?? true,
        enableDnsSupport: args.enableDnsSupport ?? true,
        tags: args.tags,
      },
      { parent: this }
    );

    this.vpcId = this.vpc.id;

    // Register outputs
    this.registerOutputs({
      vpcId: this.vpcId,
      cidrBlock: this.vpc.cidrBlock,
    });
  }
}