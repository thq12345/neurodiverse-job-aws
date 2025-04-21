# Wayfinder Job Matcher

A web application for analyzing job preferences and providing recommendations for neurodiverse individuals.

This repository represents FastAPI implementation designed to be hosted on AWS, however it can also run on local machine, just run the main.py file!

Another local implementation using Flask is available here: https://github.com/thq12345/neurodiverse-job-quest

## Overview

This application provides:
- Questionnaire data for collecting user preferences
- Analysis of user responses to identify work style and preferences
- Job recommendations based on user profile
- Storage of assessment results in AWS DynamoDB

## Architecture

The application is structured following separation of concerns:
- Backend:
  - `main.py` - FastAPI application entry point, handles routing and API endpoints
  - `app.py` - Contains business logic and data processing functions
  - Supporting modules for analysis and recommendations
- Frontend:
  - Static HTML/CSS/JavaScript files for the user interface
  - API communication through `api.js`

## Development Setup

1. Clone this repository
2. Create a `.env` file with your credentials:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=us-east-1
   OPENAI_API_KEY=your_openai_key
   LANGTRACE_API_KEY=your_langtrace_key
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```
   python main.py
   ```

## Docker Container

Build the Docker container:
```
docker build -t wayfinder-job-api .
```

Run the container:
```
docker run -p 8000:8000 --env-file .env wayfinder-job-api
```

## Deploying to AWS

### Step 1: Deploy with ECR and ECS

1. **Create an ECR Repository:**
   ```bash
   aws ecr create-repository --repository-name wayfinder-job-app
   ```

2. **Authenticate Docker to your ECR registry:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com
   ```

3. **Build, tag, and push your Docker image:**
   ```bash
   docker build -t wayfinder-job-app .
   docker tag wayfinder-job-app:latest <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/wayfinder-job-app:latest
   docker push <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/wayfinder-job-app:latest
   ```

4. **Create an ECS Cluster:**
   - Go to ECS console and create a new cluster
   - Choose "AWS Fargate" (serverless) as the launch type

5. **Create a Task Definition:**
   - Create a new task definition (Fargate launch type)
   - Configure CPU (1 vCPU) and Memory (2GB)
   - Add a container definition with your ECR image URL
   - Set port mappings (container port 80)
   - Add environment variables from your .env file

6. **Create an ECS Service:**
   - Create a new service in your cluster
   - Use the task definition you created
   - Configure desired number of tasks (1 or more for redundancy)
   - Configure VPC, subnets, and security groups
   - Enable public IP

### Step 2: Configure Application Load Balancer

1. **Create an Application Load Balancer:**
   - Go to EC2 > Load Balancers
   - Create a new Application Load Balancer
   - Configure internet-facing, VPC, and subnets
   - Configure security group to allow HTTP on port 80
   - (Optional) Configure HTTPS on port 443 with certificate

2. **Create a Target Group:**
   - Create a new target group for your ALB
   - Target type: IP
   - Protocol: HTTP, Port: 8000
   - Configure health check path `/health`
   - Set proper deregistration delay (60-120 seconds)

3. **Configure Listeners:**
   - Create a listener on port 80 (HTTP)
   - Forward traffic to your target group
   - (Optional) Add HTTPS listener on port 443

4. **Update ECS Service:**
   - Edit your ECS service to use load balancing
   - Select your target group
   - Enable service discovery if needed

5. **Update Front-end Configuration:**
   - Update `front_end/static/js/api.js` with your ALB URL:
     ```javascript
     this.apiBaseUrl = 'http://your-alb-url.us-east-1.elb.amazonaws.com';
     ```

### Step 3: Deploy Frontend to S3

1. **Create an S3 bucket:**
   ```bash
   aws s3 mb s3://your-wayfinder-frontend-bucket
   ```

2. **Enable Static Website Hosting:**
   - Go to S3 console, select your bucket
   - Properties > Static website hosting
   - Set index.html as the index document

3. **Configure public access:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-wayfinder-frontend-bucket/*"
       }
     ]
   }
   ```

4. **Upload frontend files:**
   ```bash
   aws s3 sync ./front_end/ s3://your-wayfinder-frontend-bucket
   ```

### Step 4: Force Updating ECS Deployment

When you make changes to your container image and push a new version to ECR, you need to force a new deployment to update your running service:

1. **Using AWS CLI:**
   ```bash
   aws ecs update-service --cluster your-cluster-name --service your-service-name --force-new-deployment
   ```

2. **Using AWS Console:**
   - Go to ECS > Clusters > Your Cluster
   - Select the service
   - Click "Update"
   - Check "Force new deployment" option
   - Click "Update Service"

This forces ECS to pull the latest image from ECR even if the image tag hasn't changed.

## API Endpoints

- `GET /health`: Health check endpoint
- `GET /questionnaire`: Get questionnaire data
- `POST /submit_questionnaire`: Submit answers and get analysis
- `GET /results/{assessment_id}`: Retrieve results by ID

## Frontend Structure

The frontend is a static web application with the following key files:
- `index.html` - Landing page
- `questionnaire.html` - Questionnaire form
- `results.html` - Results display page
- `static/js/api.js` - API communication
- `static/js/app.js` - Application logic
- `static/css/styles.css` - Styling

## Database Setup

Before deploying the application, you need to create the required DynamoDB tables:

```bash
# Run the table creation script
python create_tables.py
```

This script will create the following tables if they don't already exist:
- `UserAssessments` - Stores user questionnaire responses and results
- `AnalysisTemplates` - Stores pre-computed analysis templates
- `JobBank` - Stores job information for recommendations

## Troubleshooting

### JSON Serialization Issues

If you encounter errors related to Decimal serialization, check that the CustomJSONEncoder is being properly applied in app.py:

```python
# When storing data in DynamoDB
json.dumps(data, cls=CustomJSONEncoder)

# When returning API responses
return {
    "statusCode": 200,
    "body": json.dumps(data, cls=CustomJSONEncoder)
}
```

### ALB Health Check Issues

If your ALB health checks are failing:
1. Verify the health check path is `/health`
2. Check that the FastAPI application is running on port 8000
3. Make sure security groups allow traffic on port 8000

### ECS Task Failures

If your ECS tasks are failing to start:
1. Check CloudWatch logs for error messages
2. Verify IAM permissions for ECS tasks
3. Check that environment variables are properly configured

## Data Structure

The application uses a structured JSON format for profile data:

```json
{
  "work_style": {
    "description": "You thrive with a structured schedule",
    "explanation": "You prefer clear guidelines and consistent routines."
  },
  "environment": {
    "description": "You prefer quiet and private spaces",
    "explanation": "You work best in environments with minimal distractions."
  },
  "interaction_level": {
    "description": "You prefer minimal interactions",
    "explanation": "You tend to focus better when working independently."
  },
  "task_preference": {
    "description": "You prefer highly detailed and focused tasks",
    "explanation": "You excel at work requiring precision and careful attention."
  },
  "additional_insights": {
    "description": "No additional insights",
    "explanation": ""
  }
}
```

## Dependencies

```
openai>=1.0.0
boto3>=1.28.0
python-dotenv>=1.0.0
langtrace-python-sdk>=0.1.0
requests>=2.31.0
```

## Customizing Questions

You can customize the questionnaire questions by modifying the `questions` array in `app.py`. 
