import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { join } from "path";

export class SentimentAnalysisStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create python layer
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      code: lambda.Code.fromAsset("./python_layers"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      layerVersionName: "python-shared-layer",
    });

    // Create a transcribe Lambda function
    const transcribeLambda = new lambda.Function(this, 'TranscribeLambda', {
      functionName: "transcribe-lambda",
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(join(__dirname, "..", "handler")),
      handler: 'transcribe.lambda_handler',
      layers: [sharedLayer],
    });

    // Create a summarise Lambda function
    const summariseLambda = new lambda.Function(this, 'SummariseLambda', {
      functionName: "summarise-lambda",
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(join(__dirname, "..", "handler")),
      handler: 'summarise.lambda_handler',
      layers: [sharedLayer],
    });

    // Grant the Lambda functions permissions to read from the bucket
    bucket.grantRead(transcribeLambda);
    bucket.grantRead(summariseLambda);

    // Add an event notification for the Lambda function when an object is created
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(transcribeLambda), {
        suffix: ".mp3"
      }
    );
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(summariseLambda), {
        suffix: "transcript.json"
      }
    );

    // Output the bucket name
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });
  }
}
