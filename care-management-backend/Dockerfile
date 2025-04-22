# Step 1: Use an official Node.js runtime as the base image
FROM node:16

# Step 2: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Step 4: Install the app dependencies
RUN npm install

# Step 5: Copy the rest of your application code into the container
COPY . .

# Step 6: Expose the port your app will run on
EXPOSE 5000

# Step 7: Run the application
CMD ["npm", "start"]
