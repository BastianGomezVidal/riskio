import { useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Skeleton,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from "@/data/queries.hooks";
import { classifyQueryError } from "@/data/query-error";
import { ErrorEmpty, OfflineEmpty } from "@/global_components/StatusEmpty/StatusEmpty";
import { formatUTC, formatRelative } from "@/domain/datetime";
import type { ApiToken, CreatedApiToken } from "@/domain/apiTokens";

/**
 * Machine API tokens for the signed-in account.
 *
 * Two rules shape this component and both come from the server:
 *
 * The plaintext is returned exactly once, at creation. There is no endpoint
 * that reproduces it, because the server stored the digest. So the create flow
 * ends in a modal that shows the secret and the only honest copy affordance
 * available, and the list never offers one.
 *
 * Revocation is soft. `revokedAt` is stamped and the row stops appearing, so
 * the card says "revoke" rather than "delete" — the record of which credentials
 * existed outlives the credential.
 */
export function ApiTokensCard() {
  const { data: tokens, error, isPending, refetch } = useApiTokens();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);

  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();

  const retry = () => {
    void refetch();
  };

  const handleCreate = async () => {
    const label = name.trim();
    if (!label) return;

    try {
      const result = await createToken.mutateAsync(label);
      setName("");
      // Held in component state rather than the cache: the plaintext is not
      // server state and must not outlive the modal showing it.
      setCreated(result);
    } catch {
      message.error("Could not create the token. Try again.");
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    try {
      await revokeToken.mutateAsync(token.id);
      message.success(`Token "${token.name}" revoked`);
    } catch {
      message.error("Could not revoke the token. Try again.");
    }
  };

  return (
    <Card
      title="API tokens"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          loading={createToken.isPending}
          disabled={!name.trim()}
        >
          Create token
        </Button>
      }
    >
      <p className="text-sm text-(--ant-color-text-secondary)">
        Machine tokens let CI jobs and scripts call the API with the{" "}
        <code className="rounded bg-(--ant-color-fill-quaternary) px-1 font-mono">
          x-api-key
        </code>{" "}
        header. They act as your account, so treat one like a password.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleCreate}
          placeholder="Label, e.g. github-actions"
          maxLength={80}
          disabled={createToken.isPending}
        />
      </div>

      <div className="mt-6" aria-busy={isPending}>
        <TokenList
          tokens={tokens}
          error={error}
          isPending={isPending}
          onRetry={retry}
          onRevoke={handleRevoke}
          revokingId={revokeToken.isPending ? revokeToken.variables : null}
        />
      </div>

      <CreatedTokenModal token={created} onClose={() => setCreated(null)} />
    </Card>
  );
}

interface TokenListProps {
  tokens: ApiToken[] | undefined;
  error: Error | null;
  isPending: boolean;
  onRetry: () => void;
  onRevoke: (token: ApiToken) => void;
  revokingId: string | null | undefined;
}

/**
 * The list body, split out so each state is an early return like the rest of
 * the codebase rather than a conditional tree inside JSX.
 */
function TokenList({
  tokens,
  error,
  isPending,
  onRetry,
  onRevoke,
  revokingId,
}: TokenListProps) {
  if (isPending) return <Skeleton active paragraph={{ rows: 3 }} />;

  if (error) {
    const failure = classifyQueryError(error);
    if (failure.kind === "offline") return <OfflineEmpty onRetry={onRetry} />;
    if (failure.kind === "not-found") {
      return <ErrorEmpty message="Tokens unavailable." onRetry={onRetry} />;
    }
    return <ErrorEmpty message={failure.message} onRetry={onRetry} />;
  }

  if (!tokens || tokens.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No API tokens yet." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tokens.map((token) => (
        <li key={token.id}>
          <TokenRow
            token={token}
            onRevoke={onRevoke}
            revoking={revokingId === token.id}
          />
        </li>
      ))}
    </ul>
  );
}

interface TokenRowProps {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
  revoking: boolean;
}

function TokenRow({ token, onRevoke, revoking }: TokenRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--ant-color-border-secondary) p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ApiOutlined className="text-(--ant-color-text-tertiary)" />
          <span className="truncate font-medium">{token.name}</span>
          <Tag className="font-mono">{token.prefix}…</Tag>
        </div>

        <p className="mt-1 text-xs text-(--ant-color-text-secondary)">
          Created {formatUTC(token.createdAt)} ·{" "}
          {token.lastUsedAt ? (
            <span>
              last used{" "}
              <Tooltip title={formatUTC(token.lastUsedAt)}>
                <span>{formatRelative(token.lastUsedAt)}</span>
              </Tooltip>
            </span>
          ) : (
            <span>never used</span>
          )}
        </p>
      </div>

      <Button
        danger
        size="small"
        icon={<DeleteOutlined />}
        onClick={() => onRevoke(token)}
        loading={revoking}
      >
        Revoke
      </Button>
    </div>
  );
}

interface CreatedTokenModalProps {
  token: CreatedApiToken | null;
  onClose: () => void;
}

/**
 * Shows the plaintext exactly once.
 *
 * No "copy" button on the list afterwards, because there is nothing to copy:
 * the server kept a digest, not the secret. Closing this dialog is the end of
 * the user's access to the value, which is worth saying out loud in the dialog
 * rather than leaving to be discovered.
 */
function CreatedTokenModal({ token, onClose }: CreatedTokenModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.token);
      setCopied(true);
      message.success("Copied");
    } catch {
      message.error("Could not copy. Select the value and copy it manually.");
    }
  };

  return (
    <Modal
      open={token !== null}
      onCancel={onClose}
      title="Token created"
      footer={null}
      destroyOnHidden
    >
      {token && (
        <>
          <p className="text-sm">
            Copy this token now. It is shown{" "}
            <strong>once</strong> and cannot be retrieved again — the server
            stores only a digest, so it cannot be reprinted or reissued.
          </p>

          <div className="mt-4 flex items-start gap-2">
            <code
              className="min-w-0 flex-1 break-all rounded bg-(--ant-color-fill-quaternary) p-3 font-mono text-sm"
              aria-label="New API token"
            >
              {token.token}
            </code>
            <Button
              icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <p className="mt-3 text-xs text-(--ant-color-text-secondary)">
            Label: {token.name} · prefix {token.prefix}…
          </p>

          <div className="mt-6 flex justify-end">
            <Button type="primary" onClick={onClose}>
              I have saved it
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
