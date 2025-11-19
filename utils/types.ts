import * as pulumi from "@pulumi/pulumi";

/**
 * Subnet configuration interface
 */
export interface SubnetConfig {
  name: string;
  cidrBlocks: string[];
  natSubnet?: string;
  tags?: Record<string, string>;
  public?: boolean;
}

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  name: string;
  cidrBlock: string;
  subnets: SubnetConfig[];
}

/**
 * Infrastructure configuration type
 */
export type InfrastructureConfig = NetworkConfig[];

/**
 * VPC arguments interface
 */
export interface VPCArgs {
  cidrBlock: pulumi.Input<string>;
  enableDnsHostnames?: pulumi.Input<boolean>;
  enableDnsSupport?: pulumi.Input<boolean>;
  tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * Subnet arguments interface
 */
export interface SubnetArgs {
  vpcId: pulumi.Input<string>;
  cidrBlock: pulumi.Input<string>;
  availabilityZone: pulumi.Input<string>;
  mapPublicIpOnLaunch?: pulumi.Input<boolean>;
  tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * NAT Gateway arguments interface
 */
export interface NATGatewayArgs {
  subnetId: pulumi.Input<string>;
  tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * EC2 Instance arguments interface
 */
export interface EC2Args {
  projectId?: string;
  name: string;
  ami: pulumi.Input<string>;
  instanceType: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  vpcId: pulumi.Input<string>;
  keyName?: pulumi.Input<string>;
  userData?: pulumi.Input<string>;
  tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * Bastion Host arguments interface
 */
export interface BastionHostArgs {
  vpcId: pulumi.Input<string>;
  subnetId: pulumi.Input<string>;
  ami: pulumi.Input<string>;
  instanceType?: pulumi.Input<string>;
  keyName?: pulumi.Input<string>;
  allowedCidrBlocks?: pulumi.Input<string>[];
  tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}