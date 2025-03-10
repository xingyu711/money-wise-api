const express = require('express');
const bcrypt = require('bcryptjs');
const knex = require('knex');
const cors = require('cors');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const e = require('express');

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

// validate user token
app.get('/validate_user', (req, res) => {
  const {token} = req.query;
  db('usersessions').select('*').where('token', '=', token)
    .then(data => {
      if (data[0]) {
        res.json(1)
      } else {
        res.status(401).json('validation failed')
      }
    })
    .catch(err => res.status(400).json('cannot validate info'))
});

// signin page
app.post('/signin', (req, res) => {
  const {email, password} = req.body;
  const token = uuidv4();

  db.select('user_id', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        db('usersessions').insert({
          user_id: data[0].user_id,
          token: token
        }).returning('user_id')
          .then(data => {
            if (data[0]) {
              const response = {user_id: data[0], token: token}
              res.json(response);
            }
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
    trx('users')
    .returning(['user_id', 'email'])
    .insert({
      email: email,
      first_name: firstname,
      last_name: lastname,
      joined: new Date()
    })
    .then((response) => {
      return trx('login')
        .returning('*')
        .insert({
          user_id: response[0].user_id,
          email: response[0].email,
          hash: hash
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

// get user info
app.get('/user/:user_id', (req, res) => {
  const {user_id} = req.params;
  const {property} = req.query;
  if (property) {
    db('users').select(property).where('user_id', '=', user_id)
      .then(data => {
        res.json(data)
      })
      .catch(err => res.status(400).json('cannot get user info'))
  } else {
    db('users').select('*').where('user_id', '=', user_id)
      .then(data => {
        res.json(data)
      })
      .catch(err => res.status(400).json('cannot get user info'))
  }
})

// get number of total transactions
app.get('/num_transactions/:user_id', (req, res) => {
  const {user_id} = req.params;
  db('transactions').count('*').where('user_id', '=', user_id)
    .then(data => {
      res.json(data[0].count)
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get number of income transactions
app.get('/num_income/:user_id', (req, res) => {
  const {user_id} = req.params;
  db('transactions').count('*').where('user_id', '=', user_id).andWhere('basic_type', '=', 'income')
    .then(data => {
      res.json(data[0].count)
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get number of expense transactions
app.get('/num_expense/:user_id', (req, res) => {
  const {user_id} = req.params;
  db('transactions').count('*').where('user_id', '=', user_id).andWhere('basic_type', '=', 'expense')
    .then(data => {
      res.json(data[0].count)
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get total income
app.get('/sum_income/:user_id', (req, res) => {
  const {user_id} = req.params;
  db('transactions').sum('amount').where('user_id', '=', user_id).andWhere('basic_type', '=', 'income')
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get total expense
app.get('/sum_expense/:user_id', (req, res) => {
  const {user_id} = req.params;
  db('transactions').sum('amount').where('user_id', '=', user_id).andWhere('basic_type', '=', 'expense')
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get weekly income
app.get('/weekly_income/:user_id', (req, res) => {
  const {user_id} = req.params;
  var startOfWeek = moment().startOf('week').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfWeek, curr]).andWhere('basic_type', '=', 'income').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get weekly expense
app.get('/weekly_expense/:user_id', (req, res) => {
  const {user_id} = req.params;
  var startOfWeek = moment().startOf('week').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfWeek, curr]).andWhere('basic_type', '=', 'expense').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get monthly income
app.get('/monthly_income/:user_id',  (req, res) => {
  const {user_id} = req.params;
  var startOfMonth = moment().startOf('month').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfMonth, curr]).andWhere('basic_type', '=', 'income').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get monthly expense
app.get('/monthly_expense/:user_id',  (req, res) => {
  const {user_id} = req.params;
  var startOfMonth = moment().startOf('month').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfMonth, curr]).andWhere('basic_type', '=', 'expense').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get yearly income
app.get('/yearly_income/:user_id',  (req, res) => {
  const {user_id} = req.params;
  var startOfYear = moment().startOf('year').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfYear, curr]).andWhere('basic_type', '=', 'income').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// get yearly expense
app.get('/yearly_expense/:user_id',  (req, res) => {
  const {user_id} = req.params;
  var startOfYear = moment().startOf('year').toDate();
  var curr = moment().toDate();
  db('transactions').sum('amount').whereBetween('created', [startOfYear, curr]).andWhere('basic_type', '=', 'expense').andWhere('user_id', '=', user_id)
    .then(data => {
      if (!data[0].sum) {
        res.json(0)
      }
      else {
        res.json(data[0].sum)
      }
    })
    .catch(err => res.status(400).json('cannot get data'))
})

// GENERATE REPORTS
// get monthly trend
app.get('/monthly_trend', async (req, res) => {
  const {user_id, start} = req.query;
  const end = moment(req.query.end).endOf('month').toDate();

  const incomeData = await db('transactions')
  .select(db.raw(`date_trunc('month', created) as month`))
  .sum('amount as monthly_income')
  .where('basic_type', '=', 'income')
  .where('user_id', '=', user_id)
  .whereBetween('created', [start, end])
  .groupBy('month')
  .orderBy('month');
  
  const expenseData = await db('transactions')
  .select(db.raw(`date_trunc('month', created) as month`))
  .sum('amount as monthly_expense')
  .where('basic_type', '=', 'expense')
  .where('user_id', '=', user_id)
  .whereBetween('created', [start, end])
  .groupBy('month')
  .orderBy('month');

  const months = [];
  let currMonth = moment(start).startOf('month');
  while (true) {
    if (!moment(currMonth).isBefore(moment(end))) {
      break;
    }
    months.push(currMonth.toDate());
    currMonth = currMonth.add(1, 'month');
  }

  let incomeIndex = 0;
  let expenseIndex = 0;

  const result = months.reduce((a, c) => {
    const data = {month: moment(c).format('YYYY-MM')};
    if (incomeData[incomeIndex] && c.toString() === incomeData[incomeIndex].month.toString()) {
      data.monthly_income = incomeData[incomeIndex].monthly_income;
      incomeIndex++;
    } else {
      data.monthly_income = 0;
    }
    if (expenseData[expenseIndex] && c.toString() === expenseData[expenseIndex].month.toString()) {
      data.monthly_expense = expenseData[expenseIndex].monthly_expense;
      expenseIndex++;
    } else {
      data.monthly_expense = 0;
    }
    a.push(data);
    return a;
  }, []);
  
  res.json(result);
})

// load transactions
app.get('/transactions/:user_id', (req, res) => {
  const {user_id} = req.params;
  const {value} = req.query;
  if (!value) {
    db('transactions').select('*').where('user_id', '=', user_id)
    .then(data => {
      res.json(data)
    })
    .catch(err => res.status(400).json('cannot get data'))
  } else {
    db('transactions')
    .where('note', 'ilike', `%${value}%`)
    .orWhere('category', 'ilike', `%${value}%`)
    .then(data => {
      res.json(data)
    })
    .catch(err => res.status(400).json('cannot search transactions'))
  }
})

// add transaction
app.post('/transaction', (req, res) => {
  const {user_id, basic_type, category, amount, currency, created, note} = req.body;
  console.log(created);
  db('transactions')
    .returning('transaction_id')
    .insert({
      user_id: user_id,
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

// update transaction
app.put('/transaction', (req, res) => {
  const {transaction_id, basic_type, category, amount, currency, created, note} = req.body;
  db('transactions').where('transaction_id', '=', transaction_id)
    .update({
      basic_type: basic_type,
      category: category,
      amount: amount,
      currency: currency,
      created: created,
      note: note
    })
    .returning('transaction_id')
    .then(response => {
      if (response[0]) {
        res.json('successfully updated this transaction')
      }
      else {
        res.json('cannot find the transaction to update')
      }
    })
    .catch(err => res.status(400).json('cannot update'))
})

// delete transaction
app.delete('/transaction', (req, res) => {
  const { transaction_id } = req.body
  db('transactions').where('transaction_id', '=', transaction_id)
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