import * as cdk from "aws-cdk-lib";
import * as eks from "aws-cdk-lib/aws-eks";
import * as blueprints from "@aws-quickstart/eks-blueprints";

import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { TeamPlatform, TeamApplication, TeamBurnham, TeamRiker } from "../teams";


export default class BbContainersCapstonePipeline extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);
    
    const account = props?.env?.account!;
    const region = props?.env?.region!;
    
    const mgnClusterProviderProps = {
      amiType: eks.NodegroupAmiType.BOTTLEROCKET_X86_64,
      desiredSize: 1,
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
      .clusterProvider(clusterProvider) //TODO: Test without this cluster again
      .addOns(
        new blueprints.AppMeshAddOn(),
        new blueprints.AwsLoadBalancerControllerAddOn(),
        new blueprints.NginxAddOn(),
        new blueprints.CalicoOperatorAddOn(),
        new blueprints.VpcCniAddOn(),
        new blueprints.KarpenterAddOn({
          provisionerSpecs: {
            'topology.kubernetes.io/zone': ['us-east-1a', 'us-east-1b', 'us-east-1c'],
            'kubernetes.io/arch': ['amd64'],
            'karpenter.sh/capacity-type': ['spot']
          },
          subnetTags: {
            'Name': 'BbContainersCapstonePipeline-stack/dev/dev-blueprint/dev-blueprint-vpc/PrivateSubnet*'
          },
          securityGroupTags: {
            "kubernetes.io/cluster/dev-blueprint": "owned",
          },
          amiFamily: "Bottlerocket"
        }),
        new blueprints.EbsCsiDriverAddOn(),
        new blueprints.KubeviousAddOn(),
        new blueprints.ContainerInsightsAddOn(),
        new blueprints.SecretsStoreAddOn()
      )
      .teams(
        new TeamPlatform(account), 
        new TeamApplication("team-mims", account), 
        new TeamBurnham("team-burnham", account), 
        new TeamRiker("team-riker", account)
      );

    //const repoUrl = "https://github.com/nwoodII/argocd-example-apps.git";
    const repoUrl = "https://github.com/nwoodII/app-of-apps.git";
    
    const bootstrapRepo: blueprints.ApplicationRepository = {
      repoUrl,
      credentialsSecretName: "github/token/argocd",
      credentialsType: 'TOKEN',
      targetRevision: 'master'
    };

    // HERE WE GENERATE THE ADDON CONFIGURATIONS
    const devBootstrapArgo = new blueprints.ArgoCDAddOn({
      bootstrapRepo: {
        ...bootstrapRepo
      },
    });
    // const testBootstrapArgo = new blueprints.ArgoCDAddOn({
    //   bootstrapRepo: {
    //     ...bootstrapRepo,
    //     path: "envs/test",
    //   },
    // });
    // const prodBootstrapArgo = new blueprints.ArgoCDAddOn({
    //   bootstrapRepo: {
    //     ...bootstrapRepo,
    //     path: "envs/prod",
    //   },
    // });

    blueprints.CodePipelineStack.builder()
      .name("bb-containers-capstone-pipeline")
      .owner("nwoodII")
      .repository({
        repoUrl: "bb-containers-capstone",
        credentialsSecretName: "github-oauth-token",
        targetRevision: "master",
      })
      // WE ADD THE STAGES IN WAVE FROM THE PREVIOUS CODE
      .wave({
        id: "envs",
        stages: [
          {
            id: "dev",
            stackBuilder: blueprint
            .clone("us-east-1")
            .addOns(devBootstrapArgo),
          }//, 
          // {
          //   id: "test",
          //   stackBuilder: blueprint
          //     .clone("us-east-2")
          //     .addOns(testBootstrapArgo),
          // }, 
          // {
          //   id: "prod",
          //   stackBuilder: blueprint
          //     .clone("us-west-2") 
          //     .account(account)              
          //     .addOns(prodBootstrapArgo),
          // }, 
        ],
      })
      .build(scope, id + "-stack", props);
  }
}
