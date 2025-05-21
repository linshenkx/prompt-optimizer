import { HistoryManager, historyManager } from '../history/manager';
import { IHistoryManager, PromptRecord } from '../history/types';
import { ModelManager, modelManager } from '../model/manager';
import { IModelManager, ModelConfig } from '../model/types';
import { TemplateManager, templateManager } from '../template/manager';
import { ITemplateManager, Template } from '../template/types';

interface AllData {
  history?: PromptRecord[];
  models?: Array<ModelConfig & { key: string }>; // Matching ModelManager.getAllModels() return type
  userTemplates?: Template[];
}

export class DataManager {
  constructor(
    private historyManagerInstance: IHistoryManager,
    private modelManagerInstance: IModelManager,
    private templateManagerInstance: ITemplateManager,
  ) {}

  async exportAllData(): Promise<string> {
    const historyRecords = await this.historyManagerInstance.getRecords();
    const modelConfigs = await this.modelManagerInstance.getAllModels();
    const userTemplates = (await this.templateManagerInstance.listTemplates()).filter(t => !t.isBuiltin);

    const allData: AllData = {
      history: historyRecords,
      models: modelConfigs,
      userTemplates: userTemplates,
    };

    return JSON.stringify(allData, null, 2);
  }

  async importAllData(jsonData: string): Promise<void> {
    let data: AllData;
    try {
      data = JSON.parse(jsonData);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Basic validation
    if (!data || (typeof data !== 'object')) {
      throw new Error('Invalid import data format: Expected an object.');
    }
    if (data.history && !Array.isArray(data.history)) {
      throw new Error('Invalid history data: Expected an array.');
    }
    if (data.models && !Array.isArray(data.models)) {
      throw new Error('Invalid models data: Expected an array.');
    }
    if (data.userTemplates && !Array.isArray(data.userTemplates)) {
      throw new Error('Invalid userTemplates data: Expected an array.');
    }

    // Clear existing data
    await this.historyManagerInstance.clearHistory();

    const existingModels = await this.modelManagerInstance.getAllModels();
    for (const model of existingModels) {
      await this.modelManagerInstance.deleteModel(model.key);
    }

    const existingTemplates = (await this.templateManagerInstance.listTemplates()).filter(t => !t.isBuiltin);
    for (const template of existingTemplates) {
      await this.templateManagerInstance.deleteTemplate(template.id);
    }

    // Import new data
    if (data.history) {
      for (const record of data.history) {
        // Assuming addRecord can handle potential ID conflicts or that imported records are fine.
        // If addRecord auto-generates IDs, this is fine. If it expects unique IDs, conflicts might occur
        // if the imported data has IDs that clash with newly generated ones after a clear.
        // For now, proceeding with addRecord. A dedicated importRecords method in HistoryManager
        // that preserves IDs or handles conflicts would be more robust.
        try {
          await this.historyManagerInstance.addRecord(record as PromptRecord);
        } catch (error) {
          console.warn(`Skipping history record due to error: ${error instanceof Error ? error.message : String(error)}`, record);
        }
      }
    }

    if (data.models) {
      for (const modelConfig of data.models) {
        const { key, ...config } = modelConfig;
        try {
          await this.modelManagerInstance.addModel(key, config);
        } catch (error) {
          console.warn(`Skipping model config due to error: ${error instanceof Error ? error.message : String(error)}`, modelConfig);
        }
      }
    }

    if (data.userTemplates) {
      for (const template of data.userTemplates) {
        try {
          await this.templateManagerInstance.saveTemplate(template as Template);
        } catch (error) {
          console.warn(`Skipping user template due to error: ${error instanceof Error ? error.message : String(error)}`, template);
        }
      }
    }
  }
}

// Export a singleton instance, injecting the existing singletons
export const dataManager = new DataManager(
  historyManager,
  modelManager,
  templateManager
);
