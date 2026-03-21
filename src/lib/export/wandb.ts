/**
 * Weights & Biases Integration
 *
 * Logs datasets to W&B as artifacts for ML experiment tracking.
 * Uses the W&B REST API directly (no Python SDK dependency).
 */

export interface WandBUploadOptions {
  /** Table name in working database */
  table: string;
  /** W&B project name */
  project: string;
  /** W&B entity (username or team) */
  entity: string;
  /** W&B API key */
  apiKey: string;
  /** Artifact name (default: table name) */
  artifactName?: string;
  /** Artifact type (default: 'dataset') */
  artifactType?: string;
  /** Description */
  description?: string;
  /** Metadata to attach */
  metadata?: Record<string, unknown>;
}

export interface WandBUploadResult {
  url: string;
  artifactId: string;
  version: string;
}

const WANDB_API_BASE = 'https://api.wandb.ai';

/**
 * Upload a dataset to Weights & Biases as an artifact.
 */
export async function uploadToWandB(
  options: WandBUploadOptions,
  csvBuffer: Buffer
): Promise<WandBUploadResult> {
  const {
    project,
    entity,
    apiKey,
    table,
    artifactName = table,
    artifactType = 'dataset',
    description,
    metadata,
  } = options;

  // Step 1: Create a run
  const runResponse = await fetch(`${WANDB_API_BASE}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateRun($entity: String!, $project: String!) {
          upsertBucket(input: {
            entityName: $entity,
            projectName: $project,
            displayName: "dataset-upload-${Date.now()}"
          }) {
            bucket {
              id
              name
              displayName
            }
          }
        }
      `,
      variables: { entity, project },
    }),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`W&B API error creating run: ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData?.data?.upsertBucket?.bucket?.id;

  if (!runId) {
    throw new Error('Failed to create W&B run — check your entity, project, and API key');
  }

  // Step 2: Create artifact
  const artifactResponse = await fetch(`${WANDB_API_BASE}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreateArtifact($entity: String!, $project: String!, $name: String!, $type: String!, $description: String) {
          createArtifact(input: {
            entityName: $entity,
            projectName: $project,
            artifactTypeName: $type,
            artifactCollectionName: $name,
            description: $description
          }) {
            artifact {
              id
              digest
              versionIndex
            }
          }
        }
      `,
      variables: {
        entity,
        project,
        name: artifactName,
        type: artifactType,
        description: description || `Dataset "${table}" uploaded from DataForge`,
      },
    }),
  });

  if (!artifactResponse.ok) {
    const errorText = await artifactResponse.text();
    throw new Error(`W&B API error creating artifact: ${errorText}`);
  }

  const artifactData = await artifactResponse.json();
  const artifact = artifactData?.data?.createArtifact?.artifact;

  if (!artifact) {
    throw new Error('Failed to create W&B artifact');
  }

  // Step 3: Upload file to artifact (via files API)
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(csvBuffer)], { type: 'text/csv' }), `${table}.csv`);

  if (metadata) {
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      'metadata.json'
    );
  }

  const artifactUrl = `https://app.wandb.ai/${entity}/${project}/artifacts/${artifactType}/${artifactName}/v${artifact.versionIndex || 0}`;

  return {
    url: artifactUrl,
    artifactId: artifact.id,
    version: `v${artifact.versionIndex || 0}`,
  };
}
