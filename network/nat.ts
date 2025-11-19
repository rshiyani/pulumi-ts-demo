import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { NATGatewayArgs } from "../utils/types";

/**
 * NAT Gateway Component Resource
 * Creates a NAT Gateway with Elastic IP for private subnet internet access
 */
export class NATGateway extends pulumi.ComponentResource {
  public readonly natGateway: aws.ec2.NatGateway;
  public readonly eip: aws.ec2.Eip;
  public readonly natGatewayId: pulumi.Output<string>;

  constructor(
    name: string,
    args: NATGatewayArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:network:NATGateway", name, {}, opts);

    // Create Elastic IP for NAT Gateway
    this.eip = new aws.ec2.Eip(
      `${name}-eip`,
      {
        domain: "vpc",
        tags: {
          Name: `${name}-eip`,
          ...args.tags,
        },
      },
      { parent: this }
    );

    // Create NAT Gateway
    this.natGateway = new aws.ec2.NatGateway(
      `${name}-nat`,
      {
        subnetId: args.subnetId,
        allocationId: this.eip.id,
        tags: args.tags,
      },
      { parent: this, dependsOn: [this.eip] }
    );

    this.natGatewayId = this.natGateway.id;

    // Register outputs
    this.registerOutputs({
      natGatewayId: this.natGatewayId,
      eipAddress: this.eip.publicIp,
    });
  }
}
