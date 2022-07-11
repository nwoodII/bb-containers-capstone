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
            teamSecrets: [
                {
                    secretProvider: new blueprints.GenerateSecretManagerProvider('AuthPassword', 'AuthPassword'),
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
                        secretName: 'github'//,
                        // data: [
                        //     {
                        //         objectName: 'github',
                        //         key: 'GITHUB_TOKEN'
                        //     }
                        // ]
                    }
                }
            ]
        })
    }
}