// Status tag for Safe to spend: [label, tag colour]
export const stsStatusTag = (s, money) =>
  ({
    comfortable: ["COMFORTABLE", "pos"],
    tight: ["TIGHT", "gold"],
    short: [`SHORT BY ${money.fmt0(s.shortBy)}`, "neg"],
    setup: ["SET UP", "iris"],
  })[s?.status] || ["", "iris"];
