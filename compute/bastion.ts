import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { BastionHostArgs } from "../utils/types";

/**
 * Bastion Host Component Resource
 * Creates a bastion host with Tinyproxy configured for proxy access
 */
export class BastionHost extends pulumi.ComponentResource {
  public readonly instance: aws.ec2.Instance;
  public readonly securityGroup: aws.ec2.SecurityGroup;
  public readonly instanceId: pulumi.Output<string>;
  public readonly publicIp: pulumi.Output<string>;
  public readonly securityGroupId: pulumi.Output<string>;

  /**
   * Startup script to configure Tinyproxy
   */
  private readonly startupScript = `#!/bin/bash
sudo apt-get update -y
sudo apt-get install -y tinyproxy
sudo echo 'Allow localhost' >> /etc/tinyproxy/tinyproxy.conf
sudo service tinyproxy restart
`;

  constructor(
    name: string,
    args: BastionHostArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("custom:compute:BastionHost", name, {}, opts);

    // Create Security Group for Bastion Host
    this.securityGroup = new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
        vpcId: args.vpcId,
        description: "Security group for Bastion Host",
        ingress: [
          {
            description: "SSH access",
            fromPort: 22,
            toPort: 22,
            protocol: "tcp",
            cidrBlocks: args.allowedCidrBlocks || ["0.0.0.0/0"],
          },
          {
            description: "Tinyproxy access",
            fromPort: 8888,
            toPort: 8888,
            protocol: "tcp",
            cidrBlocks: args.allowedCidrBlocks || ["0.0.0.0/0"],
          },
        ],
        egress: [
          {
            description: "Allow all outbound traffic",
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
        tags: {
          Name: `${name}-sg`,
          ...args.tags,
        },
      },
      { parent: this },
    );

    // Create Bastion EC2 Instance
    this.instance = new aws.ec2.Instance(
      `${name}-instance`,
      {
        ami: args.ami,
        instanceType: args.instanceType || "t3.micro",
        subnetId: args.subnetId,
        vpcSecurityGroupIds: [this.securityGroup.id],
        keyName: args.keyName,
        userData: this.startupScript,
        associatePublicIpAddress: true,
        tags: {
          Name: `${name}`,
          Role: "bastion",
          ...args.tags,
        },
      },
      { parent: this, dependsOn: [this.securityGroup] },
    );

    this.instanceId = this.instance.id;
    this.publicIp = this.instance.publicIp;
    this.securityGroupId = this.securityGroup.id;

    // Register outputs
    this.registerOutputs({
      instanceId: this.instanceId,
      publicIp: this.publicIp,
      privateIp: this.instance.privateIp,
      securityGroupId: this.securityGroupId,
    });
  }
}
