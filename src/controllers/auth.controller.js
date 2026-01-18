import User from "../models/User.js"
import jwt from "jsonwebtoken"
import "dotenv/config"

export async function login(req, res){
   try {
     const JWT_SECRET = process.env.JSON_WEB_SECRET
     const {email, password} = req.body
     if(!email || !password){
         return res.status(400).json({message: "All fields are required"})
     }
     const user = await User.findOne({email})
     if(!user){
         return res.status(400).json({message: "User not found"})
     }
     
     // skipping password checking for now
     const token = jwt.sign({id: user._id}, JWT_SECRET, {expiresIn: "1h"})
     res.status(200).json({success:true, user, token})
   } catch (error) {
    console.log("Error while login", error);
    res.status(500).json({message: "Internal Server error"})
   }
}

export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;  //  comes from your token

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
