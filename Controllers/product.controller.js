import Product from "../models/product.schema";
import formidable from 'formidable';
import fs from "fs" //Node js file system
import {deleteFile, s3FileUpload} from "../services/imageUpload"
import Mongoose from "mongoose" //Capital Mongoose is an object, alias
import asyncHandler from '../services/asynchandler'
import CustomError from '../utils/customError'
import config from "../config/index";

export const addProduct = asyncHandler(async (req, res) => {
    const form = formidable({
        multiples: true,
        keepExtensions: true,
    });
    form.parse(req, async function (err, fields, files){
        try {
            if(err){
                throw new CustomError(err.message || "Something went wrong", 500)
            }
            // Object ID s r generated by MOngoDB using Bson. IT is faster
            // Here we are generating one ID ourselves to use with photo ids
            let productID = new Mongoose.Types.ObjectId().toHexString();
            if(!fields.name || !fields.price || !fields.description || !fields.collectionId) {
                throw new CustomError ("Please fill all details", 500)
            }
            
            // upload image
            let imgArrayResp = Promise.all(
                Object.keys(files).map(async (fileKey, index) => {
                    const element = files[fileKey]

                    const data = fs.readFileSync(element.filepath)
                    const upload = await s3FileUpload({
                        bucketName: config.S3_BUCKET_NAME,
                        key: `products/${productID}/photo_${index+1}.png`,
                        body: data,
                        contentType: element.mimetype
                    })
                    return {
                        secure_url: upload.Location
                    }
                })
            )

            // get all promise of file upload
            let imgArray = await imgArrayResp;

            const product = await Product.create({
                _id: productID,
                photos: imgArray,
                ...fields,
            })

            if(!product) {
                throw new CustomError ("Product was not created", 400)
                // TODO: Remove uploaded images
            }

            res.status(200).json({
                success: true,
                product
            })
        } catch (error) {
            return res.status(500). json({
                success: false,
                message: error.message || "Something went wrong"
            })
        }
    })
})

export const getAllProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({})

    if(!products){
        throw new CustomError("No products found", 404)
    }
    res.status(200).json({
        success: true,
        products
    })
})

export const getProductById = asyncHandler(async (req, res) => {
    const {id: productID} = req.params

    const product = await Product.findById(productID)

    if(!product){
        throw new CustomError("No product found", 404)
    }
    res.status(200).json({
        success: true,
        product
    })
})
