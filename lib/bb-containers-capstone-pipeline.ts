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
    
    //TODO: Test without this cluster again
    const mgnClusterProviderProps = {
      amiType: eks.NodegroupAmiType.BOTTLEROCKET_X86_64,
      desiredSize: 1,
      instanceTypes: [
        new ec2.InstanceType("t3.large")
      ],
      minSize: 1,
      maxSize: 10,
      nodeGroupCapacityType: eks.CapacityType.SPOT,
      version: eks.KubernetesVersion.V1_21,
    };

    const clusterProvider = new blueprints.MngClusterProvider(
      mgnClusterProviderProps
    );
    
    const karpenterAddonProps = {
      provisionerSpecs: {
        'node.kubernetes.io/instance-type': ['t3.large','t3.medium'],
        'topology.kubernetes.io/zone': ['us-east-1a'],
        'kubernetes.io/arch': ['amd64'],
        'karpenter.sh/capacity-type': ['spot']
      },
      subnetTags: {
        'karpenter.sh/discovery': 'dev-blueprint'
      },
      securityGroupTags: {
        'karpenter.sh/discovery': 'dev-blueprint'
      }
    }
    
    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region(region)
      .clusterProvider(clusterProvider) //TODO: Test without this cluster again
      .addOns(
        new blueprints.AppMeshAddOn(),
        new blueprints.AwsLoadBalancerControllerAddOn(),
        new blueprints.NginxAddOn(),
        new blueprints.CalicoAddOn(),
        new blueprints.VpcCniAddOn(),
        new blueprints.KarpenterAddOn(karpenterAddonProps),
        //new blueprints.EbsCsiDriverAddOn(),
        new blueprints.KubeviousAddOn(),
        new blueprints.ContainerInsightsAddOn(),
        new blueprints.SecretsStoreAddOn()
      )
      .teams(new TeamPlatform(account), new TeamApplication("team-mims", account));

    const repoUrl = "https://github.com/nwoodII/argocd-example-apps.git";
    
    const bootstrapRepo: blueprints.ApplicationRepository = {
      repoUrl,
      credentialsSecretName: "github/token/argocd",
      credentialsType: 'TOKEN',
      targetRevision: 'master'
    };

    // HERE WE GENERATE THE ADDON CONFIGURATIONS
    const devBootstrapArgo = new blueprints.ArgoCDAddOn({
      //namespace: 'bb-apps',
      //adminPasswordSecretName: 'adminPasswordSecretName',
      bootstrapRepo: {
        ...bootstrapRepo,
        path: "apps",
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
        credentialsSecretName: "github-token-nwoodII",
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
