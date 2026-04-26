const express = require("express");
const router = express.Router();


let users = [
  {name: "Kevin", age: 22, loggedIn: false},
  {name: "Klaus", age: 45, loggedIn: false},
  {name: "Ivan", age: 36, loggedIn: false}
];

router.get("/users", (req, res) => {
  res.json({ users });
});

router.get("/user/:name", (req, res) => {
  let name = req.params.name;
  let user = users.find(u => u.name === name);
  if(!user){
    return res.json({error: "Name was not found"})};
  res.json({ user });
});

router.get("/login/:name", (req, res) => {
  let name = req.params.name;

  let user = users.find(u => u.name === name);
  if(!user){
    return res.json({error: "User was not found"});
  };
  user.loggedIn = !user.loggedIn;
  
  res.json({
    user: user
  });
});

router.post("/user", (req, res) => {
  let name = req.body.name;
  let age = req.body.age;

  if (!name || !age) {
    return res.json({ error: "Missing Data" });
  }

  let user = users.find(u => u.name === name)
  if(user){return res.json({error: "user exists"})}

  let newUser = {
    name: name,
    age: age,
    loggedIn: false
  };

  users.push(newUser);
  res.json({ newUser });
});

router.put("/user/:name", (req, res) => {
  let name = req.params.name;
  let age = req.body.age;

  let user = users.find(u => u.name === name);

  if (!user) {
    return res.json({ error: "user not found" });
  }

  user.age = age;

  return res.json({ user });
});

router.delete("/user/:name", (req, res) => {
  let name = req.params.name;

  let user = users.find(u => u.name === name);

  if (!user) {
    return res.json({ error: "user not found" });
  }

  users = users.filter(u => u.name !== name);

  return res.json({ message: "user deleted", user });
});


module.exports = router;
