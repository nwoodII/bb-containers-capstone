import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export default class ClusterConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    const account = props?.env?.account!;
    const region = props?.env?.region!;
    
    const mgnClusterProviderProps = {
       amiType: eks.NodegroupAmiType.BOTTLEROCKET_X86_64,
      desiredSize: 4,  
      instanceTypes: [
        new ec2.InstanceType("t3.large"),
        new ec2.InstanceType("m5.large"),
      ],      
      minSize: 1,
      maxSize: 10,
      nodeGroupCapacityType: eks.CapacityType.SPOT,
      version: eks.KubernetesVersion.V1_21
    }

    const clusterProvider = new blueprints.MngClusterProvider(mgnClusterProviderProps);

    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region(region)
      .clusterProvider(clusterProvider)
      .addOns(
        new blueprints.AppMeshAddOn(),
        new blueprints.AwsLoadBalancerControllerAddOn(),
        new blueprints.NginxAddOn(),
        new blueprints.ArgoCDAddOn(),
        new blueprints.CalicoAddOn(),
        new blueprints.VpcCniAddOn(),
        new blueprints.KarpenterAddOn(),        
        new blueprints.KubeviousAddOn(),
        new blueprints.ContainerInsightsAddOn(),
        new blueprints.SecretsStoreAddOn()
      )
      .teams()
      .build(scope, id + "stack");
  }
}
