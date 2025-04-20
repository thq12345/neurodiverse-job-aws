FROM python:3.11.5-bookworm
WORKDIR /function

# Copy code & deps spec
COPY . .

# Install AWS Ric & Python deps
RUN pip install --no-cache-dir awslambdaric \
  && pip install --no-cache-dir -r requirements.txt
  
# Expose port 80 for ECS/ALB
EXPOSE 80

# Add healthcheck for ECS
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# Command to run the application on port 80
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"] 