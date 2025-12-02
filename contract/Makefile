# CHAINID=agoriclocal
# USER1ADDR=$(shell agd keys show user1 -a --keyring-backend="test")
# ACCT_ADDR=$(USER1ADDR)
# BLD=000000ubld
# # EXEC_AGD=kubectl exec -i agoriclocal-genesis-0 -c validator -- agd
# # EXEC_OSMO=kubectl exec -i osmosislocal-genesis-0 -c validator -- osmosisd

# ATOM_DENOM=ibc/BA313C4A19DFBF943586C0387E6B11286F9E416B4DD27574E6909CABE0E342FA
# ATOM=000000$(ATOM_DENOM)

# .PHONY: list
# # https://stackoverflow.com/a/73159833/7963
# list:
# 	@make -npq : 2> /dev/null | grep -v PHONY |\
# 		awk -v RS= -F: '$$1 ~ /^[^#%]+$$/ { print $$1 }'

# # ADDR=agoric1k78s7qz7rxy8afyjrqk3dntg8m83zaw3upe60p
# USERNAME ?= user1

# # ADDR := $(shell kubectl exec -i agoriclocal-genesis-0 -c validator -- sh -c '\
# #     if ! agd keys show $(USERNAME) >/dev/null 2>&1; then \
# #         agd keys add $(USERNAME) --output json; \
# #     else \
# #         agd keys show $(USERNAME) --output json; \
# #     fi' | jq -r ".address" \
# # )

# $(info USERNAME is $(USERNAME))
# # $(info ADDR is $(ADDR))

# PROVISION_POOL_ADDR=agoric1megzytg65cyrgzs6fvzxgrcqvwwl7ugpt62346

# # `CLIENTADDR` is your address from your browser wallet that you will use to interact with the orchestration dapp. 
# #`CLIENT_OSMO_ADDR` is the same, but your osmosis account.
# CLIENTADDR=agoric1jc5sfu3pjvgdt0p85mm4s95nr6kpdduvjf824x
# CLIENT_OSMO_ADDR=osmo1vgknuy6sa22tsx3dv9d8r4ukxnr908hms4x6w3

# DEPLOY=npx --no-install tsx scripts/deploy-cli.ts

# GAS_ADJUSTMENT=1.2
# SIGN_BROADCAST_OPTS=--keyring-backend=test --chain-id=$(CHAINID) \
# 		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
# 		--yes -b block

# # 1
# fund-provision-pool:
# 	$(EXEC_AGD) tx bank send faucet $(PROVISION_POOL_ADDR) 1000000000uist -y -b block;
# 	sleep 5;

# # 2
# fund: fund-provision-pool check-balance
# 	make fund-wallet;
# 	make check-balance;
# 	make provision-smart-wallet;
# 	$(EXEC_AGD) tx bank send faucet ${CLIENTADDR} 10000000000000ubld -y;
# 	sleep 5;
# 	$(EXEC_AGD) tx bank send faucet ${CLIENTADDR} 10000000000000uist -y;
# 	make fund-osmo

# fund-osmo:
# 	$(EXEC_OSMO) tx bank send faucet ${CLIENT_OSMO_ADDR} 9870000000uosmo --fees 1000uosmo -y;

# check-balance:
# 	$(EXEC_AGD) q bank balances $(ADDR)

# fund-wallet:
# 	$(EXEC_AGD) tx bank send faucet $(ADDR) 10000000000000uist -y -b block
# 	$(EXEC_AGD) tx bank send faucet $(ADDR) 10000000000000ubld -y -b block

# provision-smart-wallet:
# 	$(EXEC_AGD) keys list
# 	$(EXEC_AGD) tx swingset provision-one wallet $(ADDR) SMART_WALLET --from ${ADDR} -y -b block

# e2e:
# 	$(DEPLOY) scripts/init-orca.js

CHAINID=agoriclocal
USER1ADDR=$(shell agd keys show user1 -a --keyring-backend="test")
ACCT_ADDR=$(USER1ADDR)
BLD=000000ubld

ATOM_DENOM=ibc/BA313C4A19DFBF943586C0387E6B11286F9E416B4DD27574E6909CABE0E342FA
ATOM=000000$(ATOM_DENOM)

.PHONY: list
# https://stackoverflow.com/a/73159833/7963
list:
	@make -npq : 2> /dev/null | grep -v PHONY |\
		awk -v RS= -F: '$$1 ~ /^[^#%]+$$/ { print $$1 }'


balance-q:
	agd keys show user1 -a --keyring-backend="test"
	agd query bank balances $(ACCT_ADDR)

GAS_ADJUSTMENT=1.2
SIGN_BROADCAST_OPTS=--keyring-backend=test --chain-id=$(CHAINID) \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--yes -b block

mint100:
	make FUNDS=1000$(ATOM) fund-acct
	/usr/src/agoric-sdk/packages/agoric-cli/bin/agops vaults open --wantMinted 100 --giveCollateral 100 >/tmp/want-ist.json && \
		/usr/src/agoric-sdk/packages/agoric-cli/bin/agops perf satisfaction --executeOffer /tmp/want-ist.json --from user1 --keyring-backend=test

# Keep mint4k around a while for compatibility
mint4k:
	make FUNDS=1000$(ATOM) fund-acct
	/usr/src/agoric-sdk/packages/agoric-cli/bin/agops vaults open --wantMinted 4000 --giveCollateral 1000 >/tmp/want4k.json && \
		/usr/src/agoric-sdk/packages/agoric-cli/bin/agops perf satisfaction --executeOffer /tmp/want4k.json --from user1 --keyring-backend=test

FUNDS=321$(BLD)
fund-acct:
	agd tx bank send validator $(ACCT_ADDR) $(FUNDS) \
	  $(SIGN_BROADCAST_OPTS) \
	  -o json >,tx.json
	jq '{code: .code, height: .height}' ,tx.json

gov-q:
	agd query gov proposals --output json | \
		jq -c '.proposals[] | [.proposal_id,.voting_end_time,.status]'

gov-voting-q:
	agd query gov proposals --status=voting_period --output json | \
		jq -c '.proposals[].proposal_id'

PROPOSAL=1
VOTE_OPTION=yes
vote:
	agd tx gov vote $(PROPOSAL) $(VOTE_OPTION) --from=validator \
	  $(SIGN_BROADCAST_OPTS) \
	  -o json >,tx.json
	jq '{code: .code, height: .height}' ,tx.json

instance-q:
	agd query vstorage data published.agoricNames.instance -o json

start-contract: start-contract-qstn

start-contract-qstn:
	yarn node scripts/deploy-contract.js \
		--install dist/qstn.contract.bundle.js \
		--eval src/proposals/qstn.proposal.js

# bundle-X.json.installed show that bundle-X.json was installed
# see also e2e-tools.js
%.json.installed: %.json
	@echo '{"up-to-date": false}'

# X.js.done shows that X.js core eval ran
%.js.done: %.js
	@echo '{"up-to-date": false}'

bundles/deploy-qstn.js: src/proposals/qstn.proposal.js
	@echo '{"up-to-date": false}'

clean:
	@rm -rf bundles/
