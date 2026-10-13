import { WorkflowCommand } from "../../cli/command.js";
import { commonFlags } from "../../cli/flags.js";

export default class Deadlines extends WorkflowCommand {
  static description =
    "List incomplete tasks with a deadline on the selected day, independently of their assigned date or time block.";
  static examples = [
    "<%= config.bin %> tasks deadlines",
    "<%= config.bin %> tasks deadlines --date 2026-10-13 --json",
  ];
  static flags = { ...commonFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(Deadlines);
    await this.executeQuery("deadlines", flags);
  }
}
