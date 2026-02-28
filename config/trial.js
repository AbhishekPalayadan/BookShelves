const passport=require('passport')
const User = require('../models/userSchema')

passport.use(
    new LocalStrategy(
        async (email,password,done)=>{
            try {
                const user=await User.findOne({email,isAdmin:false});
                if(!user){
                    return done(null,false,{message:"Invalid"})
                }

                if(user.isBlocked){
                    return done(null,false,{message:"blocked"});
                }

                if(user.googleId && !user.password){
                    return done(null,false,{message:"google"})
                }
            } catch (error) {
                
            }
        }
    )
)