import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'expense-splitter-v1';

const seedData = {
  groupName: 'Casa y Viajes',
  members: [
    { id: 'm1', name: 'Ana' },
    { id: 'm2', name: 'Luis' },
    { id: 'm3', name: 'Sofía' }
  ],
  expenses: [
    {
      id: 'e1',
      title: 'Supermercado',
      payerId: 'm1',
      amount: 180,
      date: '2026-10-01',
      splitType: 'equal',
      splitAmong: ['m1', 'm2', 'm3']
    },
    {
      id: 'e2',
      title: 'Cena con amigos',
      payerId: 'm2',
      amount: 240,
      date: '2026-10-03',
      splitType: 'equal',
      splitAmong: ['m1', 'm2', 'm3']
    }
  ]
};

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const getInitialState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('Error parsing saved state', error);
    }
  }

  return seedData;
};

const calculateBalances = (group) => {
  const balances = {};

  group.members.forEach((member) => {
    balances[member.id] = { name: member.name, balance: 0 };
  });

  group.expenses.forEach((expense) => {
    const payer = expense.payerId;
    const membersToSplit = expense.splitAmong || group.members.map((member) => member.id);

    if (expense.splitType === 'equal') {
      const share = expense.amount / membersToSplit.length;
      balances[payer].balance -= expense.amount;

      membersToSplit.forEach((memberId) => {
        if (balances[memberId]) {
          balances[memberId].balance += share;
        }
      });

      return;
    }

    const customShares = expense.customShares || {};
    const totalShare = membersToSplit.reduce((sum, memberId) => sum + Number(customShares[memberId] || 0), 0);

    if (totalShare === 0) {
      const fallbackShare = expense.amount / membersToSplit.length;
      balances[payer].balance -= expense.amount;

      membersToSplit.forEach((memberId) => {
        if (balances[memberId]) {
          balances[memberId].balance += fallbackShare;
        }
      });

      return;
    }

    balances[payer].balance -= expense.amount;

    membersToSplit.forEach((memberId) => {
      if (balances[memberId]) {
        const share = (expense.amount * Number(customShares[memberId] || 0)) / totalShare;
        balances[memberId].balance += share;
      }
    });
  });

  return balances;
};

const calculateSettlements = (group) => {
  const balances = calculateBalances(group);
  const debtors = [];
  const creditors = [];

  Object.values(balances).forEach((entry) => {
    if (entry.balance < 0) {
      debtors.push({ name: entry.name, amount: Math.abs(entry.balance) });
    }

    if (entry.balance > 0) {
      creditors.push({ name: entry.name, amount: entry.balance });
    }
  });

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: Number(amount.toFixed(2))
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.01) debtorIndex += 1;
    if (creditor.amount <= 0.01) creditorIndex += 1;
  }

  return settlements;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};

const emptyExpenseForm = {
  title: '',
  amount: '',
  payerId: '',
  splitType: 'equal',
  splitAmong: [],
  date: new Date().toISOString().slice(0, 10)
};

function App() {
  const [group, setGroup] = useState(getInitialState);
  const [newMember, setNewMember] = useState('');
  const [expenseForm, setExpenseForm] = useState(() => ({
    ...emptyExpenseForm,
    payerId: getInitialState().members[0]?.id || '',
    splitAmong: getInitialState().members.map((member) => member.id)
  }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(group));
  }, [group]);

  const balances = useMemo(() => calculateBalances(group), [group]);
  const settlements = useMemo(() => calculateSettlements(group), [group]);

  const totalSpent = group.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const addMember = () => {
    const trimmed = newMember.trim();

    if (!trimmed) return;

    const member = {
      id: createId('member'),
      name: trimmed
    };

    setGroup((current) => ({
      ...current,
      members: [...current.members, member]
    }));

    setNewMember('');
    setExpenseForm((current) => ({
      ...current,
      payerId: current.payerId || member.id,
      splitAmong: [...(current.splitAmong || []), member.id]
    }));
  };

  const addExpense = () => {
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.payerId) return;

    const nextExpense = {
      id: createId('expense'),
      title: expenseForm.title,
      payerId: expenseForm.payerId,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      splitType: expenseForm.splitType,
      splitAmong: expenseForm.splitAmong.length ? expenseForm.splitAmong : group.members.map((member) => member.id)
    };

    setGroup((current) => ({
      ...current,
      expenses: [nextExpense, ...current.expenses]
    }));

    setExpenseForm({
      ...emptyExpenseForm,
      payerId: group.members[0]?.id || '',
      splitAmong: group.members.map((member) => member.id)
    });
  };

  const toggleMemberSelection = (memberId) => {
    setExpenseForm((current) => {
      const splitAmong = current.splitAmong.includes(memberId)
        ? current.splitAmong.filter((id) => id !== memberId)
        : [...current.splitAmong, memberId];

      return {
        ...current,
        splitAmong
      };
    });
  };

  const resetDemoData = () => {
    setGroup(seedData);
    setExpenseForm({
      ...emptyExpenseForm,
      payerId: seedData.members[0]?.id || '',
      splitAmong: seedData.members.map((member) => member.id)
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gestor financiero</p>
          <h1>{group.groupName}</h1>
        </div>
        <button className="secondary-btn" onClick={resetDemoData}>
          Reestablecer demo
        </button>
      </header>

      <section className="summary-grid">
        <div className="card summary-card accent">
          <span>Total gastado</span>
          <strong>{formatCurrency(totalSpent)}</strong>
        </div>
        <div className="card summary-card">
          <span>Miembros</span>
          <strong>{group.members.length}</strong>
        </div>
        <div className="card summary-card">
          <span>Gastos</span>
          <strong>{group.expenses.length}</strong>
        </div>
        <div className="card summary-card">
          <span>Saldo neto</span>
          <strong>{formatCurrency(Object.values(balances).reduce((sum, item) => sum + item.balance, 0))}</strong>
        </div>
      </section>

      <main className="content-grid">
        <section className="panel left-panel">
          <div className="panel-header">
            <h2>Miembros</h2>
          </div>

          <div className="inline-form">
            <input
              type="text"
              value={newMember}
              onChange={(event) => setNewMember(event.target.value)}
              placeholder="Añadir una persona"
            />
            <button onClick={addMember}>Añadir</button>
          </div>

          <ul className="member-list">
            {group.members.map((member) => {
              const memberBalance = balances[member.id]?.balance || 0;
              return (
                <li key={member.id} className="member-item">
                  <div>
                    <strong>{member.name}</strong>
                    <small>{memberBalance >= 0 ? 'Debe recibir' : 'Debe pagar'}</small>
                  </div>
                  <span className={memberBalance >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(memberBalance)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Registrar gasto</h2>
          </div>

          <div className="expense-form">
            <label>
              Descripción
              <input
                type="text"
                value={expenseForm.title}
                onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })}
                placeholder="Ej: Alquiler, comida, viaje"
              />
            </label>

            <div className="two-col">
              <label>
                Monto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                  placeholder="0.00"
                />
              </label>

              <label>
                Fecha
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })}
                />
              </label>
            </div>

            <label>
              Pagado por
              <select
                value={expenseForm.payerId}
                onChange={(event) => setExpenseForm({ ...expenseForm, payerId: event.target.value })}
              >
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de reparto
              <select
                value={expenseForm.splitType}
                onChange={(event) => setExpenseForm({ ...expenseForm, splitType: event.target.value })}
              >
                <option value="equal">Por partes iguales</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>

            <div className="checkbox-group">
              <p>Incluido en el gasto</p>
              {group.members.map((member) => (
                <label key={member.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={expenseForm.splitAmong.includes(member.id)}
                    onChange={() => toggleMemberSelection(member.id)}
                  />
                  {member.name}
                </label>
              ))}
            </div>

            <button className="primary-btn" onClick={addExpense}>
              Guardar gasto
            </button>
          </div>
        </section>
      </main>

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Resumen de deudas</h2>
          </div>

          <div className="settlement-list">
            {settlements.length === 0 ? (
              <p className="empty-state">Todo está cuadrado.</p>
            ) : (
              settlements.map((item, index) => (
                <div key={`${item.from}-${item.to}-${index}`} className="settlement-row">
                  <span>{item.from}</span>
                  <span className="arrow">→</span>
                  <span>{item.to}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Últimos gastos</h2>
          </div>

          <ul className="expense-list">
            {group.expenses.map((expense) => {
              const payer = group.members.find((member) => member.id === expense.payerId);
              return (
                <li key={expense.id} className="expense-item">
                  <div>
                    <strong>{expense.title}</strong>
                    <small>
                      {expense.date} · {payer?.name || 'Sin nombre'}
                    </small>
                  </div>
                  <span>{formatCurrency(expense.amount)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default App;
