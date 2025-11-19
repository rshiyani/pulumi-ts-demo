import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { SubnetArgs } from "../utils/types";

/**
 * Subnet Component Resource
 * Creates a subnet within a VPC
 */
export class Subnet extends pulumi.ComponentResource {
  public readonly subnet: aws.ec2.Subnet;
  public readonly subnetId: pulumi.Output<string>;


  constructor(
    name: string,
    args: SubnetArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:network:Subnet", name, {}, opts);

    // Create Subnet
    this.subnet = new aws.ec2.Subnet(
      `${name}-subnet`,
      {
        vpcId: args.vpcId,
        cidrBlock: args.cidrBlock,
        availabilityZone: args.availabilityZone,
        mapPublicIpOnLaunch: args.mapPublicIpOnLaunch ?? false,
        tags: args.tags,
      },
      { parent: this }
    );

    this.subnetId = this.subnet.id;

    // Register outputs
    this.registerOutputs({
      subnetId: this.subnetId,
      cidrBlock: this.subnet.cidrBlock,
      availabilityZone: this.subnet.availabilityZone,
    });
  }
}