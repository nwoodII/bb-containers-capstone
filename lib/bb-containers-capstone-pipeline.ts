import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as blueprints from "@aws-quickstart/eks-blueprints";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { TeamPlatform, TeamApplication } from "../teams";

export default class BbContainersCapstonePipeline extends Construct {
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
      version: eks.KubernetesVersion.V1_21,
    };

    const clusterProvider = new blueprints.MngClusterProvider(
      mgnClusterProviderProps
    );

    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region(region)
      .clusterProvider(clusterProvider)
      .addOns(
        new blueprints.AppMeshAddOn(),
        new blueprints.AwsLoadBalancerControllerAddOn(),
        new blueprints.NginxAddOn(),
        new blueprints.CalicoAddOn(),
        new blueprints.VpcCniAddOn(),
        new blueprints.KarpenterAddOn(),
        new blueprints.KubeviousAddOn(),
        new blueprints.ContainerInsightsAddOn(),
        new blueprints.SecretsStoreAddOn()
      )
      //.teams(new TeamPlatform(account), new TeamApplication("teamA", account));
      .teams()
      
    const repoUrl =
      "https://github.com/aws-samples/eks-blueprints-workloads.git";

    const bootstrapRepo: blueprints.ApplicationRepository = {
      repoUrl,
      targetRevision: "workshop",
    };

    // HERE WE GENERATE THE ADDON CONFIGURATIONS
    const devBootstrapArgo = new blueprints.ArgoCDAddOn({
      bootstrapRepo: {
        ...bootstrapRepo,
        path: "envs/dev",
      },
    });
    const testBootstrapArgo = new blueprints.ArgoCDAddOn({
      bootstrapRepo: {
        ...bootstrapRepo,
        path: "envs/test",
      },
    });
    const prodBootstrapArgo = new blueprints.ArgoCDAddOn({
      bootstrapRepo: {
        ...bootstrapRepo,
        path: "envs/prod",
      },
    });

    blueprints.CodePipelineStack.builder()
      .name("bb-containers-capstone-pipeline")
      .owner("nwoodII")
      .repository({
        repoUrl: "bb-containers-capstone",
        credentialsSecretName: "github-token-nwoodII",
        targetRevision: "main",
      })
      // WE ADD THE STAGES IN WAVE FROM THE PREVIOUS CODE
      .wave({
        id: "envs",
        stages: [
          {
            id: "dev",
            stackBuilder: blueprint.clone("us-west-2").addOns(devBootstrapArgo),
          }, // HERE WE ADD OUR NEW ADDON WITH THE CONFIGURED ARGO CONFIGURATIONS
          {
            id: "test",
            stackBuilder: blueprint
              .clone("us-east-2")
              .addOns(testBootstrapArgo),
          }, // HERE WE ADD OUR NEW ADDON WITH THE CONFIGURED ARGO CONFIGURATIONS
          {
            id: "prod",
            stackBuilder: blueprint
              .clone("us-east-1")
              .addOns(prodBootstrapArgo),
          }, // HERE WE ADD OUR NEW ADDON WITH THE CONFIGURED ARGO CONFIGURATIONS
        ],
      })
      .build(scope, id + "-stack", props);
  }
}
