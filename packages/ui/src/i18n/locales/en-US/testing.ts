const messages = {
  "history": {
    "title": "History",
    "iterationNote": "Iteration Note",
    "optimizedPrompt": "Optimized Prompt",
    "searchPlaceholder": "Search history...",
    "confirmClear": "Are you sure you want to clear all history records? This action cannot be undone.",
    "confirmDeleteChain": "Are you sure you want to delete this history record? This action cannot be undone.",
    "cleared": "History cleared",
    "chainDeleted": "History record deleted",
    "useThisVersion": "Use This Version",
    "noHistory": "No history records"
  },
  "test": {
    "title": "Test",
    "areaTitle": "Test Area",
    "content": "Test Content",
    "placeholder": "Enter content to test...",
    "modes": {
      "simple": "Simple Mode",
      "conversation": "Conversation Mode"
    },
    "simpleMode": {
      "label": "Test Content",
      "placeholder": "Enter content to test...",
      "help": ""
    },
    "image": {
      "attach": "Attach test image",
      "replace": "Replace test image",
      "remove": "Remove test image",
      "previewAlt": "Attached test image",
      "unsupportedFormat": "Only PNG or JPEG images are supported",
      "tooLarge": "Image must not exceed 5 MiB",
      "readFailed": "Could not read the selected image",
      "visionHint": "The selected model must support image input",
      "evaluationLabel": "Test image"
    },
    "model": "Test Model",
    "startTest": "Test",
    "startCompare": "Test",
    "testing": "Testing...",
    "toggleCompare": {
      "enable": "Enable Compare",
      "disable": "Disable Compare"
    },
    "compareMode": "Compare Mode",
    "layout": {
      "columns": "Columns",
      "workspace": "Workspace",
      "previous": "Previous",
      "original": "Original",
      "previousHelp": {
        "dynamic": "",
        "currentBase": "The workspace has unsaved edits, so this uses the current saved version.",
        "earlierSaved": "The workspace is already saved, so this uses the version before it.",
        "originalFallback": "There is no earlier version yet, so this uses the original prompt.",
        "sameAsWorkspace": "It currently matches the workspace, so compare will treat it like a retest."
      },
      "latest": "Latest",
      "runAll": "Run All",
      "runThisColumn": "Run This Column",
      "stale": "Config Changed"
    },
    "originalResult": "Result A",
    "optimizedResult": "Result B",
    "compareResultA": "Result A",
    "compareResultB": "Result B",
    "testResult": "Test Result",
    "userPromptTest": "User Prompt Test",
    "advanced": {
      "startTest": "Test",
      "result": "Test Result",
      "messageCount": "{count} messages",
      "missingVariables": "{count} missing variables"
    },
    "error": {
      "failed": "Test Failed",
      "noModel": "Please select a test model first",
      "noTestContent": "Please enter test content",
      "noWorkspacePrompt": "Workspace is empty. Please enter or generate a prompt in the workspace first",
      "noOriginalPrompt": "Please enter the original prompt first",
      "noOptimizedPrompt": "Please generate the optimized prompt first",
      "missingVariables": "Missing or empty variables: {vars}",
      "forbiddenTemplateSyntax": "Unescaped Mustache syntax (e.g. triple braces or ampersand tags) is not supported. Please use normal variable placeholders.",
      "originalTestFailed": "Original prompt test failed",
      "optimizedTestFailed": "Optimized prompt test failed",
      "saveToGlobalFailed": "Failed to save variable {name} to global"
    },
    "enableMarkdown": "Enable Markdown rendering",
    "disableMarkdown": "Disable Markdown rendering",
    "thinking": "Thinking Process",
    "variables": {
      "detected": "Variables Detected",
      "manageVariables": "Manage Variables",
      "viewPreview": "View Preview",
      "title": "Variables",
      "formTitle": "Temporary Variables",
      "variablesCount": "variables",
      "clearAll": "Clear All",
      "inputPlaceholder": "Enter variable value",
      "overridesGlobal": "Overrides global",
      "noVariables": "No variables detected",
      "previewTitle": "Preview Result",
      "firstRound": "First Round (Builtin Variables)",
      "secondRound": "Second Round (Custom Variables)",
      "builtinVars": "Builtin Variables",
      "customVars": "Custom Variables",
      "finalPreview": "Final Preview",
      "missingVars": "Missing Variables",
      "saveToGlobal": "Save to Global Variables",
      "savedToGlobal": "Saved to Global Variables",
      "emptyValueWarning": "Empty value, cannot save",
      "tempCount": "{count} temporary variables",
      "addVariable": "Add Variable",
      "nameRequired": "Variable name is required",
      "addSuccess": "Variable added successfully",
      "clearAllConfirm": "Clear all temporary variables ({count})?",
      "renameSuccess": "Variable name changed from {oldName} to {newName}",
      "renameNotSupported": "Renaming variables isn't supported in this view",
      "deleteSuccess": "Variable {name} deleted",
      "clearSuccess": "All temporary variables cleared",
      "delete": "Delete this variable",
      "fullscreenEdit": "Edit value in fullscreen"
    },
    "variableValueGeneration": {
      "generateButton": "Smart Fill Variable Values",
      "generating": "Generating intelligently...",
      "dialogTitle": "Preview Generated Variable Values",
      "variableName": "Variable Name",
      "generatedValue": "Generated Value",
      "valuePlaceholder": "Enter variable value",
      "reason": "Generation Reason",
      "confidence": "Confidence",
      "selected": "Selected",
      "batchApply": "Batch Apply ({count})",
      "noVariablesToGenerate": "No variables need values",
      "generateFailed": "Variable value generation failed",
      "applySuccess": "Successfully applied {count} variable values",
      "noPrompt": "Please enter or generate an optimized prompt first",
      "noMissingVariables": "All variables are already filled",
      "serviceNotReady": "Variable value generation service not ready",
      "noValues": "No variable values generated"
    },
    "invalidVariables": "Invalid variable data",
    "getVariablesFailed": "Failed to get variables"
  },
  "evaluation": {
    "button": "Evaluate",
    "evaluate": "Evaluate",
    "reEvaluate": "Re-evaluate",
    "compareEvaluate": "Compare",
    "loading": "Evaluating...",
    "analyzing": "Analyzing...",
    "overallScore": "Overall",
    "dimensions": "Dimension Scores",
    "issues": "Issues",
    "improvements": "Improvements",
    "applyToIterate": "Iterate",
    "rewriteFromEvaluation": "Rewrite",
    "rewriteSkipped": "The evaluation recommends keeping the current prompt unchanged, so rewrite was skipped.",
    "applySuccess": "Applying improvement...",
    "noResult": "No evaluation result yet. Click the evaluate button to start.",
    "viewDetails": "View Details",
    "feedbackAnalyze": "Focus",
    "feedbackTitle": "Focus",
    "optional": "Optional",
    "feedbackPlaceholder": "Describe what to focus on. Analysis will prioritize your notes.",
    "feedbackHint": "Esc to cancel · Ctrl/⌘+Enter to submit",
    "feedbackSubmit": "Submit & Analyze",
    "focus": "Focus",
    "focusTitle": "Focus",
    "focusPlaceholder": "Optional: what should the evaluation focus on? (e.g. output structure, missing constraints, example length)",
    "focusHint": "Leave blank to run the default smart evaluation.",
    "stale": {
      "default": "This result is based on older content. Re-run the evaluation if needed.",
      "promptOnly": "The prompt has changed. Re-run the analysis if needed.",
      "promptIterate": "The prompt or iterate request has changed. Re-run the analysis if needed.",
      "result": "The test setup or workspace has changed. Re-run the evaluation if needed.",
      "compare": "The test setup or workspace has changed. Re-run the comparison if needed."
    },
    "title": {
      "default": "Evaluation Result",
      "result": "Result Evaluation",
      "compare": "Comparison Evaluation",
      "promptOnly": "Prompt Quality Analysis",
      "promptIterate": "Iteration Analysis"
    },
    "type": {
      "result": "Evaluate This Result",
      "compare": "Compare Evaluation"
    },
    "compareConfig": {
      "button": "Comparison Settings",
      "dialogTitle": "Comparison Settings",
      "helper": "Confirm what role each test column plays. If the system suggestion looks right, you can confirm directly.",
      "helperSummary": "Pick the optimization target first. The previous version follows the current workspace automatically.",
      "summaryTitle": "This Comparison Plan",
      "currentTargetLabel": "Current Optimization Target",
      "currentTargetMissing": "Not selected yet",
      "summaryUnassigned": "Not assigned",
      "summaryUnused": "Not used in this round",
      "summaryNeedTarget": "Optimization target is required",
      "summaryAssigned": "Ready",
      "summaryRequired": "Required",
      "summaryOptional": "Optional",
      "summaryStructured": "Smart compare will judge whether the optimization target improved, whether it can learn from the teacher, and whether the conclusion looks stable.",
      "summaryGeneric": "This setup is better suited for standard comparison and will not enter pair-by-pair smart compare.",
      "summaryPairs": "Main comparison groups: {pairs}",
      "summaryHints": {
        "target": "Pick the column you are actually trying to improve in this round.",
        "baseline": "Usually the version right before the current workspace, used to verify real progress.",
        "reference": "Usually the stronger or more stable column that acts as the teacher.",
        "replica": "Use this to check whether the conclusion is stable. If previous matches the workspace, it may show up here.",
        "referenceBaseline": "Use only when you also want to inspect whether the teacher-side change holds."
      },
      "assignedHints": {
        "baselineDynamic": "Resolved automatically from the current workspace.",
        "replicaFromPrevious": "It matches the current workspace content, so it is treated as a retest."
      },
      "requireTarget": "Multiple workspace tests were detected. Please choose which one is the optimization target.",
      "targetRequired": "Please choose an optimization target first.",
      "targetNeededShort": "Choose optimization target",
      "reviewNeededShort": "Please reconfirm",
      "autoDetected": "System Suggestion",
      "manualAssigned": "Manual",
      "selectRolePlaceholder": "Choose a role",
      "restoreSuggested": "Restore suggestion",
      "suggestedRoleTag": "System suggestion: {role}",
      "unassignedTag": "Not Clear Yet",
      "unresolvedHint": "This column is not clearly assigned yet, so it will not enter the core smart compare flow.",
      "unresolvedFallbackSummary": "Columns {entries} are not clearly assigned, so this run will fall back to standard comparison.",
      "expiredManualTag": "Needs reconfirmation",
      "expiredManualSummary": "{count} older manual settings are no longer valid, so the system fell back to the current suggestion.",
      "workspaceChangedTag": "Needs reconfirmation",
      "workspaceChangedSummary": "{count} workspace role settings need review because the workspace prompt changed.",
      "keepAuto": "Keep system suggestion",
      "keepAutoWithRole": "Keep system suggestion (current: {role})",
      "useInferred": "Use System Suggestion",
      "clearManual": "Remove Manual Overrides",
      "slotSectionTitle": "Per-Column Setup",
      "slotSectionSummary": "The system already filled in a suggestion for each column. Only change it when it looks wrong.",
      "currentRoleLabel": "Current Role",
      "rolePickerLabel": "Role for this column",
      "suggestedRoleLabel": "System Suggestion",
      "workspaceChangedInline": "The workspace prompt behind this column changed. Please confirm the role again.",
      "planStructuredSummaryDynamic": "This run will center on the current optimization target and focus on whether {focuses}.",
      "planGenericSummary": "The current test columns cannot yet form a stable smart compare setup, so this run will fall back to standard comparison.",
      "structuredFocusJoiner": ", ",
      "structuredFocusFinalJoiner": ", and ",
      "structuredFocus": {
        "targetBaseline": "it improved over the previous version",
        "targetReference": "there is still a gap to the teacher",
        "referenceBaseline": "the same kind of change also holds on the teacher side",
        "targetReplica": "the current conclusion looks stable"
      },
      "previewModeLabel": "Comparison Mode",
      "previewPairsLabel": "Pair-by-pair groups",
      "previewReasonsLabel": "System Notes",
      "previewModeStructured": "Smart Compare",
      "previewModeGeneric": "Standard Compare",
      "genericFallbackSummary": "This setup will use standard comparison instead of pair-by-pair smart compare.",
      "confirmDisabled": "Resolve the conflicts before confirming",
      "noVersionLabel": "No version selected",
      "noModel": "No model selected",
      "blockingSummary": "The current role setup has conflicts. Please fix them before confirming.",
      "advancedSectionTitle": "Advanced Details",
      "advancedSectionSummary": "This section explains how the system will compare the columns and why.",
      "showAdvancedRoles": "Show Advanced Roles",
      "hideAdvancedRoles": "Hide Advanced Roles",
      "showAdvancedDetails": "View Advanced Details",
      "hideAdvancedDetails": "Hide Advanced Details",
      "advancedConflictTitle": "Issues That Need Resolution",
      "pairValues": {
        "targetBaseline": "Optimization Target vs Previous Version",
        "targetReference": "Optimization Target vs Teacher",
        "referenceBaseline": "Teacher vs Teacher Previous Version",
        "targetReplica": "Optimization Target vs Retest"
      },
      "reasonValues": {
        "duplicateTarget": "There are multiple optimization targets, so the system cannot tell which column you are truly optimizing.",
        "duplicateBaseline": "There are multiple previous versions, so the system cannot tell which one should be used as the baseline.",
        "duplicateReference": "There are multiple teachers, so the system cannot tell which column should be learned from.",
        "duplicateReferenceBaseline": "There are multiple teacher previous versions, so the system cannot tell which one belongs to the teacher side.",
        "hasAuxiliarySnapshot": "Some selected tests are not meaningful pairwise comparisons, so this run falls back to standard comparison.",
        "missingTarget": "There is no usable optimization target, so smart compare cannot start.",
        "missingStructuredCompanion": "The optimization target is missing a key companion (previous version, teacher, or retest), so core pairwise judging cannot run yet.",
        "referenceBaselineWithoutReference": "A teacher previous version exists without a matching teacher, so that evidence will not participate in smart compare."
      },
      "roleValues": {
        "target": "Optimization Target",
        "baseline": "Previous Version",
        "reference": "Teacher",
        "referenceBaseline": "Teacher Previous Version",
        "replica": "Retest",
        "auxiliary": "Other Test"
      },
      "suggestionReasons": {
        "default": "The system inferred this suggestion from the current versions, models, and prompt relationships.",
        "target": {
          "uniqueWorkspace": "This is the only workspace column, so it is suggested as the optimization target.",
          "workspace": "This is the current workspace column, so it is suggested as the optimization target."
        },
        "baseline": {
          "dynamicPrevious": "This is the previous version of the current workspace, so it is suggested as the baseline.",
          "sameModelDifferentPrompt": "It uses the same model as the optimization target but a different prompt, so it is suggested as the previous version."
        },
        "reference": {
          "samePromptDifferentModel": "This is a workspace result from a different model, so it is suggested as the teacher.",
          "differentModel": "It uses a different model from the optimization target, so it is suggested as the teacher."
        },
        "referenceBaseline": {
          "sameModelDifferentPrompt": "It uses the same model as the teacher but a different prompt, so it is suggested as the teacher's previous version."
        },
        "replica": {
          "previousMatchesWorkspace": "It matches the current workspace content, so it is suggested as a retest.",
          "samePromptAsTarget": "It uses the same prompt as the optimization target, so it is suggested as a retest."
        },
        "auxiliary": {
          "default": "This column will not enter the core pairwise smart compare, so it stays as another test."
        }
      }
    },
    "compareShared": {
      "status": {
        "needTarget": "Please choose the optimization target first.",
        "needReview": "Settings changed. Please confirm again."
      },
      "roleValues": {
        "target": "Optimization Target",
        "baseline": "Previous Version",
        "reference": "Teacher",
        "referenceBaseline": "Teacher Previous Version",
        "replica": "Retest",
        "auxiliary": "Other Test"
      },
      "roleDescriptions": {
        "target": "This is the column you are actively optimizing and trying to improve in this round.",
        "baseline": "This is the version right before the current workspace, used to decide whether the latest rewrite was a real improvement.",
        "reference": "This is the teacher output worth learning from, usually from a stronger or more stable model.",
        "referenceBaseline": "This is the previous version on the teacher side. It only appears in advanced details and helps judge whether the same change also holds on the teacher side.",
        "replica": "This is a retest used to check whether the conclusion is stable. If previous matches the workspace, it can also appear here.",
        "auxiliary": "This test can still appear in standard comparison, but it will not become a core smart-compare pair."
      },
      "roleSource": {
        "manual": "You manually confirmed this role.",
        "auto": "This role is suggested automatically by the system."
      },
      "unresolved": {
        "label": "Not Clear Yet",
        "description": "This column is not clearly mapped to a core compare role yet.",
        "source": "The system cannot currently classify it as optimization target, previous version, teacher, or retest."
      },
      "review": {
        "workspaceChanged": "The linked workspace prompt changed, so this role should be reviewed again.",
        "staleManual": "The older manual role no longer matches the current comparison setup."
      },
      "roleAction": "Click this tag to update the comparison role.",
      "assignment": {
        "unassigned": "No role has been assigned yet.",
        "manual": "You selected: {role}",
        "auto": "System suggestion: {role}"
      },
      "modeValues": {
        "structured": "Smart Compare",
        "generic": "Standard Compare"
      },
      "recommendationValues": {
        "continue": "Keep Iterating",
        "stop": "Stop for Now",
        "review": "Needs Review"
      }
    },
    "compareHelp": {
      "title": "Compare Evaluation Guide",
      "tooltip": "What is compare evaluation?"
    },
    "compareUnavailable": {
      "missingWorkspace": "Compare evaluation requires at least one workspace test result because the system needs to produce guidance for the current workspace prompt. Run the workspace column first, then compare again."
    },
    "compareSummary": {
      "decision": {
        "title": "Iteration Advice"
      },
      "reusableImprovements": "Reusable Improvements",
      "rewriteButton": "Rewrite from This Evaluation",
      "rewriteSkipHint": "The current guidance says to keep the prompt as-is unless you already confirmed there is still clear, reusable improvement headroom.",
      "rewriteMinorHint": "A smaller correction is recommended here instead of another large rewrite.",
      "compactSignals": {
        "targetVsBaseline": "Previous",
        "targetVsReferenceGap": "Teacher Gap",
        "improvementHeadroom": "Headroom",
        "overfitRisk": "Overfit"
      },
      "reasonTitles": {
        "progress": "Previous",
        "reference": "Teacher",
        "stability": "Stability"
      },
      "reasonBodies": {
        "progress": {
          "improved": "The optimization target is ahead of the previous version, but you should still confirm which gains are truly reusable.",
          "flat": "The optimization target is close to the previous version, so you should combine teacher and stability evidence before deciding the next step.",
          "regressed": "The optimization target regressed relative to the previous version, so you should inspect what went backward first."
        },
        "reference": {
          "none": "The optimization target is already close to the teacher, so another rewrite may have limited payoff.",
          "minor": "There are still a few structural moves the optimization target can learn from the teacher.",
          "major": "There is still a clear gap to the teacher, so the next round should focus on learning the stronger teacher-side strategy."
        },
        "stability": {
          "high": "The current gain may contain strong sample-fitting risk, so overfit rules should be filtered before another rewrite.",
          "medium": "There is still some overfit risk, so the next round should preserve only reusable rules more conservatively.",
          "low": "The result is already close to convergence, so confirm there is still real improvement headroom before adding more rules.",
          "default": "You still need more shared-input evidence to confirm whether this conclusion is stable."
        }
      },
      "advanced": {
        "show": "View Advanced Details",
        "hide": "Hide Advanced Details",
        "title": "Comparison Details",
        "mode": "Comparison Mode",
        "roles": "Compared Columns",
        "stopSignals": "Risk and Convergence Signals",
        "insights": "Key Findings",
        "focusSummaries": "Focused Findings",
        "pairHighlights": "Pair Highlights",
        "evidence": "Raw Evidence Highlights",
        "learnableSignals": "Learnable Signals",
        "overfit": "Overfit Risk",
        "conflicts": "Needs Manual Review",
        "judgements": "Pair-by-pair Comparisons"
      }
    },
    "compareMetadata": {
      "title": "Advanced Compare Metadata",
      "insights": "Key Findings",
      "decision": {
        "title": "Compare Decision",
        "keyEvidence": "Key Evidence",
        "nextActions": "Next Actions",
        "headlines": {
          "continue": "The optimization target is moving in the right direction, but there is still actionable improvement headroom.",
          "stop": "The current result looks close to convergence; further automatic rewrites are unlikely to help much.",
          "review": "The current compare result needs manual review before accepting another rewrite.",
          "regressed": "The optimization target appears to have regressed relative to the previous version; do not accept this rewrite directly."
        },
        "actions": {
          "inspectRegression": "Inspect what the new version removed or weakened before attempting another rewrite.",
          "reviewBeforeRewrite": "Review the conflicting evidence first, then decide whether to rewrite or keep the current version.",
          "reviewPromptValidity": "Check whether the prompt change is actually transferable, because the teacher-side evidence does not currently support it.",
          "learnFromReference": "Learn from the stronger teacher-side structure before the next rewrite.",
          "filterOverfit": "Filter out sample-specific rules and keep only reusable guidance.",
          "continueTargetedRewrite": "If you continue rewriting, focus only on the highest-signal gap instead of broad changes.",
          "acceptCurrent": "Treat the current workspace as near-converged and avoid adding more rules unless new evidence appears.",
          "verifyStability": "Re-check stability with another shared input if the current judgement is still borderline."
        }
      },
      "focusSummaries": "Focused Findings",
      "mode": "Comparison Mode",
      "roles": "Compared Columns",
      "judgements": "Pair-by-pair Comparisons",
      "pairHighlights": "Pair Highlights",
      "progressSummary": "Versus Previous Version",
      "referenceGapSummary": "Versus Teacher",
      "promptChangeSummary": "Prompt Change Validity",
      "stabilitySummary": "Stability",
      "stopSignals": "Risk and Convergence Signals",
      "evidence": "Evidence",
      "evidenceHighlights": "Evidence Highlights",
      "learnableSignals": "Learnable Signals",
      "overfitWarnings": "Overfit Warnings",
      "conflictSignals": "Needs Manual Review",
      "targetVsBaseline": "Optimization Target vs Previous Version",
      "targetVsReferenceGap": "Optimization Target vs Teacher Gap",
      "improvementHeadroom": "Improvement Headroom",
      "overfitRisk": "Overfit Risk",
      "stopRecommendation": "Recommendation",
      "stopReasons": "Reasoning Signals",
      "modeValues": {
        "structured": "Smart Compare",
        "generic": "Standard Compare"
      },
      "roleValues": {
        "target": "Optimization Target",
        "baseline": "Previous Version",
        "reference": "Teacher",
        "referenceBaseline": "Teacher Previous Version",
        "replica": "Retest",
        "auxiliary": "Other Test"
      },
      "verdictValues": {
        "left-better": "Left Better",
        "right-better": "Right Better",
        "mixed": "Mixed",
        "similar": "Similar"
      },
      "confidenceValues": {
        "low": "Low Confidence",
        "medium": "Medium Confidence",
        "high": "High Confidence"
      },
      "conflictSignalValues": {
        "improvementNotSupportedOnReference": "The optimization target improved over the previous version, but the same prompt change is not supported on the teacher side.",
        "improvementUnstableAcrossReplicas": "The target improved, but stability-check evidence suggests the gain may be unstable.",
        "regressionOutweighsCosmeticGains": "Regression against the previous version should outweigh cosmetic improvements elsewhere.",
        "sampleOverfitRiskVisible": "Reusable gains and sample-fitting gains coexist, so the safer conclusion is to keep the overfit risk visible."
      },
      "signalValues": {
        "targetVsBaseline": {
          "improved": "Improved",
          "flat": "Mostly Flat",
          "regressed": "Regressed"
        },
        "targetVsReferenceGap": {
          "none": "Very Small Gap",
          "minor": "Some Gap Remains",
          "major": "Clear Gap"
        },
        "improvementHeadroom": {
          "none": "Almost None",
          "low": "Low",
          "medium": "Moderate",
          "high": "High"
        },
        "overfitRisk": {
          "low": "Low",
          "medium": "Medium",
          "high": "High"
        },
        "stopRecommendation": {
          "continue": "Keep Iterating",
          "stop": "Stop for Now",
          "review": "Needs Review"
        }
      }
    },
    "level": {
      "excellent": "Excellent",
      "good": "Good",
      "acceptable": "Acceptable",
      "poor": "Poor",
      "veryPoor": "Very Poor"
    },
    "dimension": {
      "goalAchievement": "Goal Achievement",
      "outputQuality": "Output Quality",
      "formatCompliance": "Format Compliance",
      "relevance": "Relevance"
    },
    "optimizedBetter": "Optimized version is better",
    "originalBetter": "Original version is better",
    "syntheticInput": {
      "noExplicitText": "No extra test input was provided; the output is generated directly from the current prompt.",
      "noExplicitVariables": "No extra variable input."
    },
    "error": {
      "title": "Evaluation Failed",
      "serviceNotReady": "Evaluation service not ready, please try again later",
      "failed": "Evaluation failed: {error}",
      "noOptimizedPrompt": "No prompt to optimize"
    },
    "designContext": {
      "basic": "Design Context",
      "advanced": "Design Context"
    },
    "variableExtraction": {
      "extractButton": "Auto Extract Variables",
      "extracting": "Extracting...",
      "dialogTitle": "Auto Extraction Results",
      "variableName": "Variable Name",
      "variableValue": "Variable Value",
      "reason": "Reason",
      "category": "Category",
      "selected": "Selected",
      "batchCreate": "Batch Create",
      "noVariables": "No extractable variables identified",
      "extractFailed": "Auto extraction failed",
      "staleResult": "The prompt or variables have changed. Please extract again.",
      "createSuccess": "Successfully created {count} variables",
      "summary": "Summary",
      "workspaceNotReady": "Unable to access workspace state",
      "noPromptContent": "Please enter prompt content first",
      "noEvaluationModel": "Please select an evaluation model first",
      "serviceNotReady": "Variable extraction service not ready",
      "invalidVariableNames": "Invalid variable names (cannot start with number or # / ^ ! > &; no whitespace/braces; max {max} chars): {names}"
    },
    "diagnose": {
      "title": "Diagnosis Analysis",
      "confidence": "Confidence",
      "findings": "Findings",
      "patchPlan": "Patch Plan",
      "noFindings": "No issues found",
      "noPatchPlan": "No patch plan",
      "applyFix": "Apply Fix",
      "replaceNow": "Replace Now",
      "invariantsWarning": "Constrained by invariants",
      "changeBudgetWarning": "Constrained by change budget",
      "status": {
        "ok": "Diagnosis OK",
        "degraded": "Partially Degraded",
        "failed": "Diagnosis Failed"
      },
      "severity": {
        "critical": "Critical",
        "major": "Major",
        "minor": "Minor",
        "suggestion": "Suggestion",
        "unknown": "Unknown"
      },
      "anchorType": {
        "text": "Text",
        "section": "Section",
        "pattern": "Pattern"
      },
      "operation": {
        "insert": "Insert",
        "replace": "Replace",
        "delete": "Delete"
      },
      "anchorPosition": {
        "before": "Before",
        "after": "After",
        "replace": "Replace"
      },
      "invariantsRisks": "Invariant Risks"
    }
  }
} as const;

export default messages;
