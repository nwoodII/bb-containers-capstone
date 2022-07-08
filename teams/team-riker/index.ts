import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { ApplicationTeam } from '@aws-quickstart/eks-blueprints';


export class TeamRiker extends ApplicationTeam {
    constructor(name: string, accountID: string) {
        super({
            name: name, 
            users: [
                new ArnPrincipal(`arn:aws:iam::${accountID}:user/riker`)
            ]
        })
    }
}