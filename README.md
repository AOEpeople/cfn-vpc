# VPC Setup 

Author: [Fabrizio Branca](https://github.com/fbrnc)

"Inspired" by this [blog post](http://www.spacevatican.org/2015/12/20/cloudformation-nat-gateway/) ([code](https://gist.github.com/fcheung/baec53381350a4b11037))

This template is intended to be used with [StackFormation](https://github.com/AOEpeople/StackFormation) - a CLI tool that helps you manage and deploy 
CloudFormation stacks and also does some preprocessing (e.g. introduces `Fn::FileContent`)

This concept of setting up a VPC consists of three parts:

1.) Deploy the `lambda.template` (requires an S3 bucket for the code) that will create an AWS Lambda function that
allows you to create NAT Gateways and Routes using custom resources in CloudFormation

2.) Deploy the `vpc.template` for the basic VPC and Internet Gateway setup

3.) Deploy the `az.template` for every availability zone you want to use in your VPC. This template will create a public
and a private subnet including all routes (+ tables + associations) and a NAT Gateway (+ Elastic IP)
Using a separate template for every AZ allows you to keep the code DRY. [StackFormation](https://github.com/AOEpeople/StackFormation)' s
prefixed template merging feature helps you to combine all the AZ templates into one and deploy them as a single CloudFormation template.
Check `stack.example.yml' for an example.