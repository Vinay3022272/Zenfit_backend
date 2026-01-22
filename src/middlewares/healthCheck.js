import jwt from "jsonwebtoken";

export const authCheck = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];
    

    const decoded = jwt.verify(token, process.env.JSON_WEB_SECRET);

    // console.log("Decoded Token data:", decoded); //  YOU WILL SEE IT NOW

    req.user = decoded;
    next();
  } 
  catch (error) {
    console.log("JWT Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};
