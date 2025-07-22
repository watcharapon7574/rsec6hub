export interface Signer {
  id: string;
  name: string;
  position: string;
  employee_id: string;
  signature_url?: string;
}

export interface SelectedSigner extends Signer {
  comment?: string;
}

export interface SignatureBlock {
  id: string;
  role: 'assistant' | 'deputy' | 'director';
  label: string;
  signer: SelectedSigner;
  position: {
    x: number;
    y: number;
    page: number;
  };
  visible: boolean;
}

export type SignerRole = 'assistant' | 'deputy' | 'director';

export interface AvailableSigners {
  assistant: Signer[];
  deputy: Signer[];
  director: Signer[];
}

export interface SelectedSigners {
  assistant?: SelectedSigner;
  deputy?: SelectedSigner;
  director?: SelectedSigner;
}