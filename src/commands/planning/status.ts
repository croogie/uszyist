import { WorkflowCommand } from "../../cli/command.js";
import { commonFlags } from "../../cli/flags.js";

export default class Status extends WorkflowCommand {
  static description =
    "Check whether an incomplete task of the day has a complete time block. Uses USZYIST_DAY_TASK_LABEL (default: zadanie-dnia). Completed tasks do not qualify: finishing the last qualifying task may change the status to false. This is not a persisted record of morning planning.";
  static examples = [
    "<%= config.bin %> planning status",
    "<%= config.bin %> planning status --date 2026-10-13 --json",
  ];
  static flags = { ...commonFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(Status);
    await this.executeQuery("planning", flags);
  }
}
