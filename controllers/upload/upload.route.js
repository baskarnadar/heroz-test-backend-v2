const express = require("express");
const router = express.Router();

const { uploadFile, getFileStream } = require("./upload");

const multer = require("multer");

const storage = multer.memoryStorage({
    destination: function (req, file, callback) {
        callback(null, "");
    },
});

const uploads = multer({ storage }).single("image");

// router.post("/uploadImage", uploads, async (req, res) => {
//     try {

//         // console.log(req.files);

//         // uploading to AWS S3

//         const result = await uploadFile(req.files.image);
//         console.log("Upload response", result);

//         res.send({
//             status: "success",
//             message: "File uploaded successfully",
//             data: result,
//         });


//     } catch (error) {
//         console.log(error);
//     }

// });



router.post("/uploadImage", uploads, async (req, res) => {

    console.log(req.body.foldername);
    try {
        if (!req.file) {
            return res.status(400).send({
                status: "error",
                message: "No file uploaded",
            });
        }

        // Uploading to AWS S3
        const result = await uploadFile(req.file, req.body.foldername, );
        console.log("Upload response", result);

        res.send({
            status: "success",
            message: "File uploaded successfully",
            data: result,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            status: "error",
            message: "File upload failed",
        });
    }
});



router.post("/getUploadedImage", (req, res) => {

    const key = req.body.key;
    // console.log(req.params.key);
    try {
        const readStream = getFileStream(key);
        // console.log(readStream);
        readStream.pipe(res);

    } catch (error) {
        console.log();
        res.send(error)
    }

});

module.exports = router;

