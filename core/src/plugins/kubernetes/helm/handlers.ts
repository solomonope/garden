/*
 * Copyright (C) 2018-2021 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ModuleAndRuntimeActionHandlers } from "../../../types/plugin/plugin"
import { HelmModule, configureHelmModule } from "./config"
import { getServiceStatus } from "./status"
import { deployHelmService, deleteService } from "./deployment"
import { getTestResult } from "../test-results"
import { runHelmTask, runHelmModule } from "./run"
import { getServiceLogs } from "./logs"
import { testHelmModule } from "./test"
import { getPortForwardHandler } from "../port-forward"
import { getTaskResult } from "../task-results"
import { GetPortForwardParams } from "../../../types/plugin/service/getPortForward"
import { KubernetesPluginContext } from "../config"
import { getModuleNamespace } from "../namespace"
import { join } from "path"
import { pathExists } from "fs-extra"
import chalk = require("chalk")
import { SuggestModulesParams, SuggestModulesResult } from "../../../types/plugin/module/suggestModules"
import { getReleaseName } from "./common"
import { hotReloadK8s } from "../hot-reload/hot-reload"
import { execInHelmService } from "./exec"

export const helmHandlers: Partial<ModuleAndRuntimeActionHandlers<HelmModule>> = {
  configure: configureHelmModule,
  getModuleOutputs: async ({ moduleConfig }) => {
    return {
      outputs: {
        "release-name": getReleaseName(moduleConfig),
      },
    }
  },
  execInService: execInHelmService,
  deleteService,
  deployService: deployHelmService,
  // Use the same getPortForward handler as container and kubernetes-module, except set the namespace
  getPortForward: async (params: GetPortForwardParams) => {
    const { ctx, log, module } = params
    const k8sCtx = <KubernetesPluginContext>ctx
    const namespace = await getModuleNamespace({
      ctx: k8sCtx,
      log,
      module,
      provider: k8sCtx.provider,
      skipCreate: true,
    })
    return getPortForwardHandler({ ...params, namespace })
  },
  getServiceLogs,
  getServiceStatus,
  getTaskResult,
  getTestResult,
  hotReloadService: hotReloadK8s,
  // TODO: add publishModule handler
  runModule: runHelmModule,
  runTask: runHelmTask,
  suggestModules: async ({ name, path }: SuggestModulesParams): Promise<SuggestModulesResult> => {
    const chartPath = join(path, "Chart.yaml")
    if (await pathExists(chartPath)) {
      return {
        suggestions: [
          {
            description: `based on found ${chalk.white("Chart.yaml")}`,
            module: {
              type: "helm",
              name,
              chartPath: ".",
            },
          },
        ],
      }
    } else {
      return { suggestions: [] }
    }
  },
  testModule: testHelmModule,
}
