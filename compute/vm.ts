import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { EC2Args } from "../utils/types";

/**
 * EC2 Instance Component Resource
 * Creates a configurable EC2 instance with security group
 */
export class EC2 extends pulumi.ComponentResource {
  public readonly instance: aws.ec2.Instance;
  public readonly securityGroup: aws.ec2.SecurityGroup;
  public readonly instanceId: pulumi.Output<string>;
  public readonly publicIp: pulumi.Output<string>;

  constructor(
    name: string,
    args: EC2Args,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:compute:EC2", name, {}, opts);

    // Create Security Group
    this.securityGroup = new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
        vpcId: args.vpcId,
        description: `Security group for ${args.name}`,
        tags: {
          Name: `${name}-sg`,
          ...args.tags,
        },
      },
      { parent: this }
    );

    // Create EC2 Instance
    this.instance = new aws.ec2.Instance(
      `${name}-instance`,
      {
        ami: args.ami,
        instanceType: args.instanceType,
        subnetId: args.subnetId,
        vpcSecurityGroupIds: [this.securityGroup.id],
        keyName: args.keyName,
        userData: args.userData,
        tags: {
          Name: args.name,
          ...args.tags,
        },
      },
      { parent: this, dependsOn: [this.securityGroup] }
    );

    this.instanceId = this.instance.id;
    this.publicIp = this.instance.publicIp;

    // Register outputs
    this.registerOutputs({
      instanceId: this.instanceId,
      publicIp: this.publicIp,
      privateIp: this.instance.privateIp,
      securityGroupId: this.securityGroup.id,
    });
  }
}