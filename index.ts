import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { VPC } from "./network/vpc";
import { Subnet } from "./network/subnet";
import { NATGateway } from "./network/nat";
import { BastionHost } from "./compute/bastion";
import { InfrastructureConfig, NetworkConfig } from "./utils/types";

// Load configs
const config = new pulumi.Config();

export let exportOutputs: { [key: string]: pulumi.Output<any> } = {};

// Get the configuration from Pulumi stack config
const infraConfig = config.requireObject<InfrastructureConfig>("network");

// Optional bastion configuration
const bastionUsername = config.get("bastionUsername") || "ubuntu";
const bastionKeyName = config.get("bastionKeyName");

// Get available availability zones
const availableAZs = aws.getAvailabilityZones({
  state: "available",
});

// Get latest Ubuntu AMI for bastion host
const ubuntuAmi = aws.ec2.getAmi({
  mostRecent: true,
  owners: ["amazon"],
  filters: [
    {
      name: "name",
      values: ["al2023-ami-2023.*-x86_64"],
    },
    {
      name: "virtualization-type",
      values: ["hvm"],
    },
  ],
});

// Process each network configuration
infraConfig.forEach((network: NetworkConfig) => {
  // Create VPC
  const vpc = new VPC(network.name, {
    cidrBlock: network.cidrBlock,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
      Name: network.name,
    },
  });

  // Track created subnets for each subnet group
  const subnetGroups: { [key: string]: aws.ec2.Subnet[] } = {};
  const publicSubnets: aws.ec2.Subnet[] = [];
  const privateSubnets: aws.ec2.Subnet[] = [];

  // Create Internet Gateway
  const igw = new aws.ec2.InternetGateway(
    `${network.name}-igw`,
    {
      vpcId: vpc.vpc.id,
      tags: {
        Name: `${network.name}-igw`,
      },
    },
    { parent: vpc },
  );

  // map of NAT gateways by subnet group name
  const natGateways: { [key: string]: NATGateway } = {};

  // Create NAT subnets and gateways for private subnet groups
  network.subnets.forEach((subnetConfig) => {
    const isPublic = subnetConfig.public || false;

    if (subnetConfig.natSubnet && !isPublic) {
      availableAZs.then((azs) => {
        const natAz = azs.names[0];

        // Create NAT subnet component
        const natSubnet = new Subnet(
          `${network.name}-${subnetConfig.name}-nat`,
          {
            vpcId: vpc.vpc.id,
            cidrBlock: subnetConfig.natSubnet!,
            availabilityZone: natAz,
            mapPublicIpOnLaunch: true,
            tags: {
              Name: `${network.name}-${subnetConfig.name}-nat`,
              Type: "nat",
              ...subnetConfig.tags,
            },
          },
          { parent: vpc },
        );

        // Create NAT Gateway
        const natGateway = new NATGateway(
          `${network.name}-${subnetConfig.name}-nat-gw`,
          {
            subnetId: natSubnet.subnet.id,
            tags: {
              Name: `${network.name}-${subnetConfig.name}-nat-gw`,
            },
          },
          { parent: vpc, dependsOn: [natSubnet.subnet] },
        );

        natGateways[subnetConfig.name] = natGateway;

        // Create route table for NAT subnet (routes to IGW)
        const natRouteTable = new aws.ec2.RouteTable(
          `${network.name}-${subnetConfig.name}-nat-rt`,
          {
            vpcId: vpc.vpc.id,
            tags: {
              Name: `${network.name}-${subnetConfig.name}-nat-rt`,
            },
          },
          { parent: vpc },
        );

        new aws.ec2.Route(
          `${network.name}-${subnetConfig.name}-nat-route`,
          {
            routeTableId: natRouteTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: igw.id,
          },
          { parent: natRouteTable, dependsOn: [igw] },
        );

        new aws.ec2.RouteTableAssociation(
          `${network.name}-${subnetConfig.name}-nat-rta`,
          {
            subnetId: natSubnet.subnet.id,
            routeTableId: natRouteTable.id,
          },
          { parent: natRouteTable, dependsOn: [natSubnet.subnet] },
        );
      });
    }
  });

  // Create application subnets
  availableAZs.then((azs) => {
    network.subnets.forEach((subnetConfig) => {
      const isPublic = subnetConfig.public || false;
      subnetGroups[subnetConfig.name] = [];

      subnetConfig.cidrBlocks.forEach((cidrBlock, idx) => {
        const azIndex = idx % azs.names.length;
        const az = azs.names[azIndex];

        // Create subnet
        const subnet = new Subnet(
          `${network.name}-${subnetConfig.name}-${idx}`,
          {
            vpcId: vpc.vpc.id,
            cidrBlock: cidrBlock,
            availabilityZone: az,
            mapPublicIpOnLaunch: isPublic,
            tags: {
              Name: `${network.name}-${subnetConfig.name}-${az}`,
              Type: isPublic ? "public" : "private",
              ...subnetConfig.tags,
            },
          },
          { parent: vpc },
        );

        subnetGroups[subnetConfig.name].push(subnet.subnet);

        if (isPublic) {
          publicSubnets.push(subnet.subnet);
        } else {
          privateSubnets.push(subnet.subnet);
        }

        // Create route table for this subnet
        const routeTable = new aws.ec2.RouteTable(
          `${network.name}-${subnetConfig.name}-${idx}-rt`,
          {
            vpcId: vpc.vpc.id,
            tags: {
              Name: `${network.name}-${subnetConfig.name}-${az}-rt`,
            },
          },
          { parent: vpc },
        );

        // Add route based on subnet type
        if (isPublic) {
          // Public subnets route to Internet Gateway
          new aws.ec2.Route(
            `${network.name}-${subnetConfig.name}-${idx}-route`,
            {
              routeTableId: routeTable.id,
              destinationCidrBlock: "0.0.0.0/0",
              gatewayId: igw.id,
            },
            { parent: routeTable, dependsOn: [igw] },
          );
        } else if (natGateways[subnetConfig.name]) {
          // Private subnets route to NAT Gateway
          new aws.ec2.Route(
            `${network.name}-${subnetConfig.name}-${idx}-route`,
            {
              routeTableId: routeTable.id,
              destinationCidrBlock: "0.0.0.0/0",
              natGatewayId: natGateways[subnetConfig.name].natGateway.id,
            },
            { parent: routeTable, dependsOn: [natGateways[subnetConfig.name]] },
          );
        }

        // Associate route table with subnet
        new aws.ec2.RouteTableAssociation(
          `${network.name}-${subnetConfig.name}-${idx}-rta`,
          {
            subnetId: subnet.subnet.id,
            routeTableId: routeTable.id,
          },
          { parent: routeTable, dependsOn: [subnet.subnet] },
        );

        // Export subnet IDs
      });
    });

    // Deploy Bastion Host in first public subnet
    // Find the first public subnet group
    const publicSubnetConfig = network.subnets.find((s) => s.public);
    if (publicSubnetConfig && publicSubnetConfig.cidrBlocks.length > 0) {
      ubuntuAmi.then((ami) => {
        // Get the first public subnet from the subnetGroups
        const firstPublicSubnet = subnetGroups[publicSubnetConfig.name][0];

        const bastion = new BastionHost(
          `${network.name}-${publicSubnetConfig.name}-bastion`,
          {
            vpcId: vpc.vpc.id,
            subnetId: firstPublicSubnet.id,
            ami: ami.id,
            instanceType: "t3.micro",
            keyName: bastionKeyName,
            tags: {
              Name: `${network.name}-${publicSubnetConfig.name}-bastion`,
              Role: "bastion-proxy",
            },
          },
          { parent: vpc, dependsOn: [firstPublicSubnet, igw] },
        );

        // Export bastion outputs
        exportOutputs[`${network.name}-bastion-public-ip`] = bastion.publicIp;
        exportOutputs[`${network.name}-bastion-instance-id`] =
          bastion.instanceId;
        exportOutputs[`${network.name}-bastion-security-group-id`] =
          bastion.securityGroupId;
      });
    }

    // Export VPC ID
    exportOutputs[`${network.name}-vpc-id`] = vpc.vpc.id;
  });
});
