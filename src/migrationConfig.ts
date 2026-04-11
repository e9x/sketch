import Config from "./Config";
import { getStorage } from "./consts";

export interface MigrationConfig {
  skincMigrated: boolean;
  bingMigrated: boolean;
  fsMigrated: boolean;
  gmMigrated: boolean;
}

const defaultConfig: MigrationConfig = {
  skincMigrated: false,
  bingMigrated: false,
  fsMigrated: false,
  gmMigrated: false,
};

const migrationConfig = new Config<MigrationConfig>(defaultConfig, getStorage());

export async function initMigrationConfig() {
  await migrationConfig.init();
}

export default migrationConfig;
