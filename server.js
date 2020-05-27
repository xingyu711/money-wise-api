const express = require('express');
const bcrypt = require('bcryptjs');
const knex = require('knex');
const cors = require('cors');

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'xingyulai',
    password : '',
    database : 'money-wise'
  }
});

const app = express();
app.use(express.json());
app.use(cors());

// main page
app.get('/', (req, res) => {res.json('this is the main page')})

// signin page
app.post('/signin', (req, res) => {
  const {email, password} = req.body;
  db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db.select('*').from('users')
          .where('email', '=', email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials');
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

// register page
app.post('/register', (req, res) => {
  const {firstname, lastname, email, password} = req.body;
  const hash = bcrypt.hashSync(password);
  
  db.transaction(trx => {
    trx('login')
    .returning('email')
    .insert({
      email: email,
      hash: hash
    })
    .then(loginEmail => {
      return trx('users')
        .returning('*')
        .insert({
          firstname: firstname,
          lastname: lastname,
          email: loginEmail[0],
          joined: new Date()
        })
        .then(user => {
          res.json(user[0])
        })
    })
    .then(trx.commit)
    .catch(trx.rollback);
  })
  .catch(err => res.status(400).json('unable to register'))
})

// add transaction
app.post('/transaction', (req, res) => {
  const {basic_type, category, amount, currency, created, note} = req.body;
  db('transactions')
    .returning('id')
    .insert({
      basic_type: basic_type,
      category: category,
      amount: amount,
      currency: currency,
      created: created,
      note: note
    })
    .then(response => {
      if (response[0]) {
        res.json('success')
      }
    })
    .catch(err => res.status(400).json('cannot add transaction'))
})

app.get('/transaction', (req, res) => {
  db.select('*').from('transactions')
    .then(data => {
      res.json(data)
    })
    .catch(err => res.status(400).json('cannot get data'))
})

app.delete('/transaction', (req, res) => {
  const { id } = req.body
  db('transactions').where('id', '=', id)
    .del()
    .then(response => {
      if (response == 1) {
        res.json('success')
      } else {
        res.json('cannot find the data')
      }
    })
    .catch(err => res.status(400).json('cannot delete transaction'))
})

app.listen(3000);