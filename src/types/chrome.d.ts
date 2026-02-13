/**
 * Minimal Chrome Extension API type declarations.
 * Covers only the APIs used by Smart Capture.
 */

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      id?: string;
    }

    function sendMessage(message: unknown): Promise<any>;
    function sendMessage(
      extensionId: string,
      message: unknown,
    ): Promise<any>;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void,
        ) => boolean | void,
      ): void;
    };

    const onInstalled: {
      addListener(callback: (details: { reason: string }) => void): void;
    };

    function openOptionsPage(): void;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }

    function query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
    }): Promise<Tab[]>;

    function get(tabId: number): Promise<Tab>;

    function create(createProperties: { url?: string }): void;

    function sendMessage(tabId: number, message: unknown): Promise<any>;
  }

  namespace scripting {
    function executeScript(details: {
      target: { tabId: number };
      files: string[];
    }): Promise<any>;
  }

  namespace action {
    interface BadgeTextDetails {
      text: string;
      tabId?: number;
    }

    function setBadgeText(details: BadgeTextDetails): Promise<void>;
    function setBadgeBackgroundColor(details: {
      color: string;
      tabId?: number;
    }): Promise<void>;
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys: string | string[]): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      getBytesInUse(keys?: string | string[]): Promise<number>;
      QUOTA_BYTES?: number;
    }

    const local: StorageArea;
    const sync: StorageArea;
  }
}
