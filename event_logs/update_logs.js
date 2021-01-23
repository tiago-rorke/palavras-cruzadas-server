"use strict";

// to add variables in .env to process.env
const dotenv = require("dotenv");
dotenv.config();

// to read and write files and folders:
const fs = require("fs");

// AWS S3 for file storage
const aws = require('aws-sdk');

const log_file = "events.log"
const log_nospoilers = "events_nospoilers.log"

s3SyncFile(log_file);
s3SyncFile(log_nospoilers);


// ---------------------- AWS S3 for file storage ------------------ //

const s3 = new aws.S3({
  accessKeyId: process.env.AWSAccessKeyId,
  secretAccessKey: process.env.AWSSecretKey,
  Bucket: process.env.S3_BUCKET_NAME
});

// not sure why we need to pass the bucket name again, but hey
const aws_bucket = process.env.S3_BUCKET_NAME;

async function s3Download(file) {
  return new Promise((resolve, reject) => {
    s3.createBucket({Bucket: aws_bucket}, () => {
      s3.getObject({Bucket: aws_bucket, Key: file}, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  });
}

async function s3Upload(file, contents) {
  return new Promise((resolve, reject) => {
    s3.createBucket({Bucket: aws_bucket}, () => {
      s3.putObject({Bucket: aws_bucket, Key: file, Body: contents}, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  });
}

async function s3SyncFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", async (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // if file doesn't exist, get it from the bucket
          console.log(file, "not found, getting from S3 bucket...");
          let s3_data = await s3Download(file);
          await fs.writeFile(file, s3_data.Body, (err) => {
              if (err) {
                return console.log(err);
              } else {
                console.error("done");
                resolve(true);
              }
            }
          );
        } else {
          console.error(err);
          reject(err);
          //throw err;
        }
      } else {
        // otherwise, upload it to the bucket
        console.log("uploading " + file + " to S3 bucket...");
        await s3Upload(file, data);
        console.error("done");
        resolve(true);
      }
    });
  });
}

async function s3test() {
  console.log("s3 upload test...");
  let updata = await s3Upload("test.txt", "hello s3");
  console.log(updata);
  console.log("s3 download test...")
  let data = await s3Download("config.json");
  let data_p = JSON.parse(data.Body);
  console.log(data_p);
}

// for testing the s3 configuration
//s3test();
