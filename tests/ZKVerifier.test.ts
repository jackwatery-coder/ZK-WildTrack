import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV } from "@stacks/transactions";

const ERR_INVALID_PROOF = 100;
const ERR_UNAUTHORIZED = 101;
const ERR_NOT_FOUND = 102;
const ERR_ALREADY_EXISTS = 103;
const ERR_INVALID_HASH = 104;
const ERR_INVALID_TIMESTAMP = 105;
const ERR_INVALID_SPECIES = 106;
const ERR_INVALID_PATTERN = 107;
const ERR_INVALID_SUBMITTER = 108;
const ERR_PROOF_EXPIRED = 109;
const ERR_INVALID_REGION = 110;
const ERR_INVALID_HERD_SIZE = 111;
const ERR_INVALID_DURATION = 112;
const ERR_INVALID_VERIFIER = 113;
const ERR_MAX_PROOFS_EXCEEDED = 114;
const ERR_INVALID_STATUS = 115;
const ERR_INVALID_METADATA = 116;
const ERR_INVALID_SCORE = 117;
const ERR_INSUFFICIENT_STAKE = 118;
const ERR_ALREADY_VERIFIED = 119;
const ERR_INVALID_UPDATE = 120;

interface Proof {
  proofHash: Uint8Array;
  dataHash: Uint8Array;
  submitter: string;
  timestamp: number;
  species: string;
  patternType: string;
  region: string;
  herdSize: number;
  duration: number;
  metadata: Uint8Array;
  status: boolean;
  score: number;
}

interface ProofUpdate {
  updateTimestamp: number;
  updater: string;
  newStatus: boolean;
  newScore: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ZKVerifierMock {
  state: {
    nextProofId: number;
    maxProofs: number;
    submissionFee: number;
    admin: string;
    verifierContract: string | null;
    minStake: number;
    proofExpiry: number;
    proofs: Map<number, Proof>;
    proofsByHash: Map<string, number>;
    proofUpdates: Map<number, ProofUpdate>;
  } = {
    nextProofId: 0,
    maxProofs: 10000,
    submissionFee: 500,
    admin: "ST1ADMIN",
    verifierContract: null,
    minStake: 1000,
    proofExpiry: 144,
    proofs: new Map(),
    proofsByHash: new Map(),
    proofUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProofId: 0,
      maxProofs: 10000,
      submissionFee: 500,
      admin: "ST1ADMIN",
      verifierContract: null,
      minStake: 1000,
      proofExpiry: 144,
      proofs: new Map(),
      proofsByHash: new Map(),
      proofUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setVerifierContract(contractPrincipal: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_UNAUTHORIZED };
    this.state.verifierContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxProofs(newMax: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE };
    this.state.maxProofs = newMax;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  setMinStake(newMin: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_UPDATE };
    this.state.minStake = newMin;
    return { ok: true, value: true };
  }

  setProofExpiry(newExpiry: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newExpiry <= 0) return { ok: false, value: ERR_INVALID_UPDATE };
    this.state.proofExpiry = newExpiry;
    return { ok: true, value: true };
  }

  submitProof(
    proofHash: Uint8Array,
    dataHash: Uint8Array,
    species: string,
    patternType: string,
    region: string,
    herdSize: number,
    duration: number,
    metadata: Uint8Array,
    score: number
  ): Result<number> {
    if (this.state.nextProofId >= this.state.maxProofs) return { ok: false, value: ERR_MAX_PROOFS_EXCEEDED };
    if (proofHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (dataHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!species || species.length > 50) return { ok: false, value: ERR_INVALID_SPECIES };
    if (!["migration", "breeding", "feeding"].includes(patternType)) return { ok: false, value: ERR_INVALID_PATTERN };
    if (!region || region.length > 100) return { ok: false, value: ERR_INVALID_REGION };
    if (herdSize <= 0) return { ok: false, value: ERR_INVALID_HERD_SIZE };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (score > 100) return { ok: false, value: ERR_INVALID_SCORE };
    const hashKey = proofHash.toString();
    if (this.state.proofsByHash.has(hashKey)) return { ok: false, value: ERR_ALREADY_EXISTS };
    if (!this.state.verifierContract) return { ok: false, value: ERR_INVALID_VERIFIER };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.verifierContract });

    const id = this.state.nextProofId;
    const proof: Proof = {
      proofHash,
      dataHash,
      submitter: this.caller,
      timestamp: this.blockHeight,
      species,
      patternType,
      region,
      herdSize,
      duration,
      metadata,
      status: false,
      score,
    };
    this.state.proofs.set(id, proof);
    this.state.proofsByHash.set(hashKey, id);
    this.state.nextProofId++;
    return { ok: true, value: id };
  }

  getProof(id: number): Proof | null {
    return this.state.proofs.get(id) || null;
  }

  verifyProof(id: number, newStatus: boolean, newScore: number): Result<boolean> {
    const proof = this.state.proofs.get(id);
    if (!proof) return { ok: false, value: ERR_NOT_FOUND };
    if (this.caller !== this.state.verifierContract) return { ok: false, value: ERR_INVALID_VERIFIER };
    if (this.blockHeight - proof.timestamp > this.state.proofExpiry) return { ok: false, value: ERR_PROOF_EXPIRED };
    if (newScore > 100) return { ok: false, value: ERR_INVALID_SCORE };
    if (proof.status) return { ok: false, value: ERR_ALREADY_VERIFIED };

    const updated: Proof = {
      ...proof,
      status: newStatus,
      score: newScore,
    };
    this.state.proofs.set(id, updated);
    this.state.proofUpdates.set(id, {
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      newStatus,
      newScore,
    });
    return { ok: true, value: true };
  }

  getProofCount(): Result<number> {
    return { ok: true, value: this.state.nextProofId };
  }

  checkProofExistence(proofHash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.proofsByHash.has(proofHash.toString()) };
  }
}

describe("ZKVerifier", () => {
  let contract: ZKVerifierMock;

  beforeEach(() => {
    contract = new ZKVerifierMock();
    contract.reset();
  });

  it("submits a proof successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    const result = contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const proof = contract.getProof(0);
    expect(proof?.species).toBe("Elephant");
    expect(proof?.patternType).toBe("migration");
    expect(proof?.region).toBe("Africa");
    expect(proof?.herdSize).toBe(50);
    expect(proof?.duration).toBe(30);
    expect(proof?.score).toBe(80);
    expect(proof?.status).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2VERIFIER" }]);
  });

  it("rejects duplicate proof hashes", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    const result = contract.submitProof(
      proofHash,
      dataHash,
      "Lion",
      "breeding",
      "Asia",
      20,
      15,
      metadata,
      90
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_EXISTS);
  });

  it("rejects submission without verifier contract", () => {
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    const result = contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VERIFIER);
  });

  it("rejects invalid proof hash", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(31).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    const result = contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid species", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    const result = contract.submitProof(
      proofHash,
      dataHash,
      "",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SPECIES);
  });

  it("verifies a proof successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    contract.caller = "ST2VERIFIER";
    const result = contract.verifyProof(0, true, 90);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(0);
    expect(proof?.status).toBe(true);
    expect(proof?.score).toBe(90);
    const update = contract.state.proofUpdates.get(0);
    expect(update?.newStatus).toBe(true);
    expect(update?.newScore).toBe(90);
    expect(update?.updater).toBe("ST2VERIFIER");
  });

  it("rejects verification for non-existent proof", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST2VERIFIER";
    const result = contract.verifyProof(99, true, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_FOUND);
  });

  it("rejects verification by non-verifier", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    contract.caller = "ST3FAKE";
    const result = contract.verifyProof(0, true, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VERIFIER);
  });

  it("rejects verification for expired proof", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    contract.blockHeight = 200;
    contract.caller = "ST2VERIFIER";
    const result = contract.verifyProof(0, true, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROOF_EXPIRED);
  });

  it("rejects verification for already verified proof", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    contract.caller = "ST2VERIFIER";
    contract.verifyProof(0, true, 90);
    const result = contract.verifyProof(0, false, 70);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_VERIFIED);
  });

  it("sets submission fee successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    const result = contract.setSubmissionFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(1000);
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2VERIFIER" }]);
  });

  it("rejects submission fee change by non-admin", () => {
    contract.caller = "ST1TEST";
    const result = contract.setSubmissionFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("returns correct proof count", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash1 = new Uint8Array(32).fill(1);
    const dataHash1 = new Uint8Array(32).fill(2);
    const metadata1 = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash1,
      dataHash1,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata1,
      80
    );
    const proofHash2 = new Uint8Array(32).fill(4);
    const dataHash2 = new Uint8Array(32).fill(5);
    const metadata2 = new Uint8Array(10).fill(6);
    contract.submitProof(
      proofHash2,
      dataHash2,
      "Lion",
      "breeding",
      "Asia",
      20,
      15,
      metadata2,
      90
    );
    const result = contract.getProofCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks proof existence correctly", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    const dataHash = new Uint8Array(32).fill(2);
    const metadata = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash,
      dataHash,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata,
      80
    );
    const result = contract.checkProofExistence(proofHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(0);
    const result2 = contract.checkProofExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects proof submission with max proofs exceeded", () => {
    contract.caller = "ST1ADMIN";
    contract.setVerifierContract("ST2VERIFIER");
    contract.setMaxProofs(1);
    contract.caller = "ST1TEST";
    const proofHash1 = new Uint8Array(32).fill(1);
    const dataHash1 = new Uint8Array(32).fill(2);
    const metadata1 = new Uint8Array(10).fill(3);
    contract.submitProof(
      proofHash1,
      dataHash1,
      "Elephant",
      "migration",
      "Africa",
      50,
      30,
      metadata1,
      80
    );
    const proofHash2 = new Uint8Array(32).fill(4);
    const dataHash2 = new Uint8Array(32).fill(5);
    const metadata2 = new Uint8Array(10).fill(6);
    const result = contract.submitProof(
      proofHash2,
      dataHash2,
      "Lion",
      "breeding",
      "Asia",
      20,
      15,
      metadata2,
      90
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PROOFS_EXCEEDED);
  });

  it("sets verifier contract successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setVerifierContract("ST2VERIFIER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.verifierContract).toBe("ST2VERIFIER");
  });

  it("rejects verifier contract set by non-admin", () => {
    contract.caller = "ST1TEST";
    const result = contract.setVerifierContract("ST2VERIFIER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });
});