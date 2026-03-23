const mongoose = require("mongoose");
const User = require("./models/userSchema");

mongoose.connect("mongodb://localhost:27017/BookShelves");

function generateReferralCode(name){
  return name.substring(0,4).toUpperCase() + Math.floor(1000 + Math.random()*9000)
}

async function updateUsers(){

  const users = await User.find({ referralCode: null });

  for(const user of users){

    const code = generateReferralCode(user.fullname);

    await User.updateOne(
      { _id: user._id },
      { $set: { referralCode: code } }
    );

    console.log("Updated:", user.fullname, code);

  }

  console.log("Referral codes added to old users");
  process.exit();

}

updateUsers();