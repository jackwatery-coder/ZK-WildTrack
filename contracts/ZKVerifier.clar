(define-constant ERR-INVALID-PROOF u100)
(define-constant ERR-UNAUTHORIZED u101)
(define-constant ERR-NOT-FOUND u102)
(define-constant ERR-ALREADY-EXISTS u103)
(define-constant ERR-INVALID-HASH u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-INVALID-SPECIES u106)
(define-constant ERR-INVALID-PATTERN u107)
(define-constant ERR-INVALID-SUBMITTER u108)
(define-constant ERR-PROOF-EXPIRED u109)
(define-constant ERR-INVALID-REGION u110)
(define-constant ERR-INVALID-HERD-SIZE u111)
(define-constant ERR-INVALID-DURATION u112)
(define-constant ERR-INVALID-VERIFIER u113)
(define-constant ERR-MAX-PROOFS-EXCEEDED u114)
(define-constant ERR-INVALID-STATUS u115)
(define-constant ERR-INVALID-METADATA u116)
(define-constant ERR-INVALID-SCORE u117)
(define-constant ERR-INSUFFICIENT-STAKE u118)
(define-constant ERR-ALREADY-VERIFIED u119)
(define-constant ERR-INVALID-UPDATE u120)

(define-data-var next-proof-id uint u0)
(define-data-var max-proofs uint u10000)
(define-data-var submission-fee uint u500)
(define-data-var admin principal tx-sender)
(define-data-var verifier-contract (optional principal) none)
(define-data-var min-stake uint u1000)
(define-data-var proof-expiry uint u144)

(define-map proofs
  uint
  {
    proof-hash: (buff 32),
    data-hash: (buff 32),
    submitter: principal,
    timestamp: uint,
    species: (string-utf8 50),
    pattern-type: (string-utf8 50),
    region: (string-utf8 100),
    herd-size: uint,
    duration: uint,
    metadata: (buff 256),
    status: bool,
    score: uint
  }
)

(define-map proofs-by-hash
  (buff 32)
  uint
)

(define-map proof-updates
  uint
  {
    update-timestamp: uint,
    updater: principal,
    new-status: bool,
    new-score: uint
  }
)

(define-read-only (get-proof (id uint))
  (map-get? proofs id)
)

(define-read-only (get-proof-updates (id uint))
  (map-get? proof-updates id)
)

(define-read-only (is-proof-registered (proof-hash (buff 32)))
  (is-some (map-get? proofs-by-hash proof-hash))
)

(define-private (validate-proof-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-data-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-species (sp (string-utf8 50)))
  (if (and (> (len sp) u0) (<= (len sp) u50))
      (ok true)
      (err ERR-INVALID-SPECIES))
)

(define-private (validate-pattern-type (pt (string-utf8 50)))
  (if (or (is-eq pt "migration") (is-eq pt "breeding") (is-eq pt "feeding"))
      (ok true)
      (err ERR-INVALID-PATTERN))
)

(define-private (validate-region (reg (string-utf8 100)))
  (if (and (> (len reg) u0) (<= (len reg) u100))
      (ok true)
      (err ERR-INVALID-REGION))
)

(define-private (validate-herd-size (size uint))
  (if (> size u0)
      (ok true)
      (err ERR-INVALID-HERD-SIZE))
)

(define-private (validate-duration (dur uint))
  (if (> dur u0)
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-metadata (meta (buff 256)))
  (if (<= (len meta) u256)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-score (sc uint))
  (if (<= sc u100)
      (ok true)
      (err ERR-INVALID-SCORE))
)

(define-private (validate-submitter (sub principal))
  (if (not (is-eq sub tx-sender))
      (ok true)
      (err ERR-INVALID-SUBMITTER))
)

(define-private (validate-verifier (ver principal))
  (if (is-eq ver (unwrap! (var-get verifier-contract) (err ERR-INVALID-VERIFIER)))
      (ok true)
      (err ERR-INVALID-VERIFIER))
)

(define-private (is-expired (ts uint))
  (if (> (- block-height ts) (var-get proof-expiry))
      (err ERR-PROOF-EXPIRED)
      (ok true))
)

(define-public (set-verifier-contract (contract-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (var-set verifier-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-proofs (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (asserts! (> new-max u0) (err ERR_INVALID_UPDATE))
    (var-set max-proofs new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR_INVALID_UPDATE))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (set-min-stake (new-min uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (asserts! (> new-min u0) (err ERR_INVALID_UPDATE))
    (var-set min-stake new-min)
    (ok true)
  )
)

(define-public (set-proof-expiry (new-expiry uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (asserts! (> new-expiry u0) (err ERR_INVALID_UPDATE))
    (var-set proof-expiry new-expiry)
    (ok true)
  )
)

(define-public (submit-proof
  (proof-hash (buff 32))
  (data-hash (buff 32))
  (species (string-utf8 50))
  (pattern-type (string-utf8 50))
  (region (string-utf8 100))
  (herd-size uint)
  (duration uint)
  (metadata (buff 256))
  (score uint)
)
  (let (
    (next-id (var-get next-proof-id))
    (current-max (var-get max-proofs))
    (verifier (var-get verifier-contract))
  )
    (asserts! (< next-id current-max) (err ERR_MAX_PROOFS-EXCEEDED))
    (try! (validate-proof-hash proof-hash))
    (try! (validate-data-hash data-hash))
    (try! (validate-species species))
    (try! (validate-pattern-type pattern-type))
    (try! (validate-region region))
    (try! (validate-herd-size herd-size))
    (try! (validate-duration duration))
    (try! (validate-metadata metadata))
    (try! (validate-score score))
    (asserts! (is-none (map-get? proofs-by-hash proof-hash)) (err ERR_ALREADY-EXISTS))
    (asserts! (is-some verifier) (err ERR_INVALID-VERIFIER))
    (try! (stx-transfer? (var-get submission-fee) tx-sender (unwrap! verifier (err ERR_INVALID-VERIFIER))))
    (map-set proofs next-id
      {
        proof-hash: proof-hash,
        data-hash: data-hash,
        submitter: tx-sender,
        timestamp: block-height,
        species: species,
        pattern-type: pattern-type,
        region: region,
        herd-size: herd-size,
        duration: duration,
        metadata: metadata,
        status: false,
        score: score
      }
    )
    (map-set proofs-by-hash proof-hash next-id)
    (var-set next-proof-id (+ next-id u1))
    (print { event: "proof-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (verify-proof (proof-id uint) (new-status bool) (new-score uint))
  (let ((proof (map-get? proofs proof-id)))
    (match proof
      p
        (begin
          (try! (validate-verifier tx-sender))
          (try! (is-expired (get timestamp p)))
          (try! (validate-score new-score))
          (asserts! (not (get status p)) (err ERR_ALREADY_VERIFIED))
          (map-set proofs proof-id
            (merge p { status: new-status, score: new-score })
          )
          (map-set proof-updates proof-id
            {
              update-timestamp: block-height,
              updater: tx-sender,
              new-status: new-status,
              new-score: new-score
            }
          )
          (print { event: "proof-verified", id: proof-id })
          (ok true)
        )
      (err ERR_NOT-FOUND)
    )
  )
)

(define-public (get-proof-count)
  (ok (var-get next-proof-id))
)

(define-public (check-proof-existence (proof-hash (buff 32)))
  (ok (is-proof-registered proof-hash))
)