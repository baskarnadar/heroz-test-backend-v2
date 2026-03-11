const S3 = require("aws-sdk/clients/s3");

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;
const foldernamedir = process.env.DIRECTORY;

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

function getNameFromFileName(name) {
  let filename = name.replace(/\.[^/.]+$/, "");
  let ext = name.split('.').pop();
  const d1 = new Date();
  const result = d1.getTime();
  let finalName = `${filename}_${result}.${ext}`;
  return finalName.replace(/ /g, '');
}

// UPLOAD FILE TO S3
function uploadFile(file, getFolderNameVal) {
  console.log(file);

  const buffer = file.buffer; // Use the buffer from the file object
  const folderName = getFolderNameVal; // Specify the folder name
  const fileName = getNameFromFileName(file.originalname); // Use original name and custom logic to generate a final name

  const uploadParams = {
    Bucket: bucketName,
    Body: buffer,
    Key: folderName + "/"+fileName,  // Save to folder in S3 (foldername + generated name)
    ContentType: file.mimetype,  // Set the content type based on the file's MIME type
  };

  return s3.upload(uploadParams).promise();
}

// DOWNLOAD FILE FROM S3
function getFileStream(fileKey) {
  const downloadParams = {
    Key: fileKey,
    Bucket: bucketName,
  };

  try {
    return s3.getObject(downloadParams).createReadStream();
  } catch (error) {
    return error;
  }
}

module.exports = { uploadFile, getFileStream };
