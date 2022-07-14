import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { ApplicationTeam } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';

export class TeamBurnham extends ApplicationTeam {
    constructor(name: string, accountID: string) {
        super({
            name: name, 
            users: [
                new ArnPrincipal(`arn:aws:iam::${accountID}:user/burnham`)
            ],
            namespaceAnnotations: {
                "appmesh.k8s.aws/sidecarInjectorWebhook": "enabled"
            },
            teamSecrets: [
                {
                    secretProvider: new blueprints.GenerateSecretManagerProvider('AuthPassword', 'auth-password'),
                    kubernetesSecret: {
                        secretName: 'auth-password',
                        data: [
                            {
                                key: 'password'
                            }
                        ]
                    }
                },
                {
                    secretProvider: new blueprints.LookupSsmSecretByAttrs('GITHUB_TOKEN', 1),
                    kubernetesSecret: {
                        secretName: 'github'
                    }
                }
            ]
        })
    }
}