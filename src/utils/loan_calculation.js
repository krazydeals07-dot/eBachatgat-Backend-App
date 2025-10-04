//  Flat Interest Calculation
//  Total Interest = (Principal * Rate * Time) 
//  Total Amount = Principal + Total Interest 
//  Monthly EMI = Total Amount / (Tenure in Months)

//  Reducing Balance Interest Calculation
// Monthly EMI = [P x R x (1+R)^N] / [(1+R)^N - 1], where: 
// Weekly EMI = [P x rw x (1 + rw)^n] / [((1 + rw)^n) - 1]
// P = Principal Amount 
// R = Monthly Interest Rate (Annual Rate / 12) 
// N = Loan Tenure in Months 
// Total Interest = (Monthly EMI * Number of Months) - Principal 
// Total Amount = Monthly EMI * Number of Months 

const monthlyInstallmentCalculation = {
    flatInterestCalculation: (loanAmount, interestRate, repaymentPeriod) => {
        const totalInterest = (loanAmount * (interestRate / 100) * repaymentPeriod);
        const totalAmount = loanAmount + totalInterest;
        const monthlyInstallment = totalAmount / (repaymentPeriod * 12);
        return {
            installment: Math.round(monthlyInstallment),
            totalInterest: Math.round(totalInterest),
            totalAmount: Math.round(totalAmount),
            noOfInstallments: repaymentPeriod * 12
        };
    },
    reducingBalanceInterestCalculation: (loanAmount, interestRate, repaymentPeriod) => {
        let formula = `[P x R x (1+R)^N] / [(1+R)^N - 1]`; // formula to calculate monthly installment
        let P = loanAmount;
        let R = (interestRate / 100) / 12;
        let N = repaymentPeriod * 12;
        let monthlyInstallment = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
        let totalInterest = (monthlyInstallment * N) - P;
        let totalAmount = monthlyInstallment * N;
        return {
            installment: Math.round(monthlyInstallment),
            totalInterest: Math.round(totalInterest),
            totalAmount: Math.round(totalAmount),
            noOfInstallments: repaymentPeriod * 12
        };
    }
};

const weeklyInstallmentCalculation = {
    flatInterestCalculation: (loanAmount, interestRate, repaymentPeriod) => {
        const totalInterest = (loanAmount * (interestRate / 100) * repaymentPeriod);
        const totalAmount = loanAmount + totalInterest;
        const weeklyInstallment = totalAmount / (repaymentPeriod * 52);
        return {
            installment: Math.round(weeklyInstallment),
            totalInterest: Math.round(totalInterest),
            totalAmount: Math.round(totalAmount),
            noOfInstallments: repaymentPeriod * 52
        };
    },
    reducingBalanceInterestCalculation: (loanAmount, interestRate, repaymentPeriod) => {
        let formula = `[P x rw x (1 + rw)^n] / [((1 + rw)^n) - 1]`;
        let P = loanAmount;
        let rw = (interestRate / 100) / 52;
        let n = repaymentPeriod * 52;
        let weeklyInstallment = (P * rw * Math.pow(1 + rw, n)) / (Math.pow(1 + rw, n) - 1);
        let totalInterest = (weeklyInstallment * n) - P;
        let totalAmount = weeklyInstallment * n;
        return {
            installment: Math.round(weeklyInstallment),
            totalInterest: Math.round(totalInterest),
            totalAmount: Math.round(totalAmount),
            noOfInstallments: repaymentPeriod * 52
        }
    }
}

function getFlatLoanBreakdown(principal, interest, noOfInstallments, installmentNumber) {
    let principalComponent = principal / noOfInstallments;
    let interestComponent = interest / noOfInstallments;
    let remainingPrincipal = principal - (principalComponent * installmentNumber);

    return {
        principalComponent: Math.round(principalComponent),
        interestComponent: Math.round(interestComponent),
        remainingPrincipal: Math.round(remainingPrincipal)
    };
}

function getReducingLoanBreakdown(remainingPrincipal, interestRate, installmentAmount, isMonthly = true) {
    let monthlyRate = interestRate / 12 / 100;
    let weeklyRate = interestRate / 52 / 100;
    
    let interestComponent = remainingPrincipal * (isMonthly ? monthlyRate : weeklyRate);
    let principalComponent = installmentAmount - interestComponent;

    return {
        principalComponent: Math.round(principalComponent),
        interestComponent: Math.round(interestComponent),
        remainingPrincipal: Math.round(remainingPrincipal - principalComponent)
    };
}


module.exports = {
    monthlyInstallmentCalculation,
    weeklyInstallmentCalculation,
    getFlatLoanBreakdown,
    getReducingLoanBreakdown
}