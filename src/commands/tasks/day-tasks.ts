import { Flags } from "@oclif/core";
import { WorkflowCommand } from "../../cli/command.js";
import { commonFlags } from "../../cli/flags.js";

export default class DayTasks extends WorkflowCommand {
  static description =
    "List incomplete tasks assigned to a day with USZYIST_DAY_TASK_LABEL (default: zadanie-dnia). A label alone does not imply a time block.";
  static examples = [
    "<%= config.bin %> tasks day-tasks",
    "<%= config.bin %> tasks day-tasks --time-blocked --json",
  ];
  static flags = {
    ...commonFlags,
    "time-blocked": Flags.boolean({
      description: "Require a concrete start and a positive duration.",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(DayTasks);
    await this.executeQuery("day-tasks", flags);
  }
}
