// server/services/expenseSummary.ts
import { ExpenseModel as Expense } from "../models.js";

export async function getUserExpenseSummary(userId: string, start: Date, end: Date) {
  const pipeline = [
    { $match: { userId, date: { $gte: start, $lte: end } } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } }
  ];
  const result = await Expense.aggregate(pipeline);

  // Example result: [ { _id: "Food", total: 1200 }, { _id: "Travel", total: 800 } ]
  return result;
}
