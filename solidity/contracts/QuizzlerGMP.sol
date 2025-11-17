// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IERC20.sol";
import "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutableWithToken.sol";
import "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";

/// @title A Quizzler contract for creating and managing surveys with rewards via Axelar GMP
/// @notice This contract allows for the creation, funding, and management of surveys and their rewards
contract QuizzlerGMP is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, AxelarExecutableWithToken {
    using Address for address;

    IAxelarGasService public immutable gasService;

    /// @notice Name of the chain where this contract is deployed
    string public chainName;

    /// @notice Identifier used when sending a cross-chain message to create a survey on target chains
    uint256 public constant CREATE_SURVEY_MSG_ID = 0;

    /// @notice Identifier used when sending a cross-chain message to cancel a survey on target chains
    uint256 public constant CANCEL_SURVEY_MSG_ID = 1;

    /// @notice Identifier used when sending a cross-chain message to pay rewards to survey participants on target chains
    uint256 public constant PAY_REWARDS_MSG_ID = 2;

    /// @notice Constant ensuring that the source chain is the anticipated AGORIC chain. NOTE: string literal comes from Axelar.
    bytes32 public constant AGORIC_CHAIN_HASH = keccak256(bytes("agoric"));

    /// @notice Tracks manager permissions for addresses
    mapping(address => bool) public managers;

    /// @notice Stores survey data by survey ID
    mapping(string => SurveyStruct) public surveys;

    /// @notice Users rewarded for participating in surveys
    mapping(string => mapping(string => bool)) public surveysUsersRewarded;

    /// @notice Records used proof tokens to prevent reuse
    mapping(bytes32 => bool) public proofTokens;

    /// @notice Structure to store survey information
    struct SurveyStruct {
        string surveyCreator;
        uint256 participantsLimit;
        uint256 rewardAmount;
        uint256 participantsRewarded;
        bytes32 surveyHash;
        address rewardToken;
        string rewardSymbol;
        bool isCanceled;
    }

    /// @notice Emitted when a survey is created
    event SurveyCreated(
        string indexed surveyId,
        string indexed creator,
        uint256 participantsLimit,
        uint256 rewardAmount,
        bytes32 surveyHash
    );

    /// @notice Emitted when a reward is paid to a participant
    event RewardPaid(string indexed participant, string indexed surveyId, uint256 amount);
    /// @notice Emitted when a survey is finished
    event SurveyFinished(string indexed surveyId);
    /// @notice Emitted when a survey is canceled
    event SurveyCanceled(string indexed surveyId);
    /// @notice Emitted when a manager's status is updated
    event UpdateManager(address indexed manager, bool status);
    /// @notice Emitted when an execute with token event is completed
    event ExecuteEventCompleted(bytes32 indexed commandId, uint256 msgId);

    /// @notice Thrown when the source of the call is incorrect
    error Quizzler__WrongSource();
    /// @notice Thrown when there are no tokens available
    error Quizzler__NoTokens();
    /// @notice Thrown when the sender is not authorized
    error Quizzler__WrongSender();
    /// @notice Thrown when the message ID is invalid
    error Quizzler__WrongMsgId();
    /// @notice Thrown when the signer is invalid
    error Quizzler_InvalidSigner();
    /// @notice Thrown when attempting to create a survey that already exists
    error Quizzler__SurveyExists();
    /// @notice Thrown when the reward amount is invalid
    error Quizzler_InvalidRewardAmount();
    /// @notice Thrown when the transaction value is invalid
    error Quizzler_InvalidTrxValue();
    /// @notice Thrown when the manager address is invalid
    error Quizzler__InvalidManagerAddress();
    /// @notice Thrown when a function restricted to manager is called by non-manager
    error Quizzler_OnlyManager();
    /// @notice Thrown when attempting to interact with a non-existent survey
    error Quizzler__SurveyDoesNotExist();
    /// @notice Thrown when attempting to interact with an already canceled survey
    error Quizzler__SurveyAlreadyCanceled();
    /// @notice Thrown when all participants have already been rewarded
    error Quizzler__AllParticipantsRewarded();
    /// @notice Thrown when array lengths don't match in input parameters
    error Quizzler__ArrayLengthMismatch();
    /// @notice Thrown when attempting to reward a user who has already been rewarded
    error Quizzler__UserAlreadyRewarded();
    /// @notice Thrown when the message hash is invalid
    error Quizzler__InvalidMessageHash();
    /// @notice Thrown when the token has already been used
    error Quizzler__TokenAlreadyUsed();
    /// @notice Thrown when the proof has expired
    error Quizzler__ProofExpired();
    /// @notice Thrown when a zero address is provided where it's not allowed
    error Quizzler__ZeroAddress();
    /// @notice Thrown when survey cancellation fails
    error Quizzler__SurveyCancelFailed();
    /// @notice Thrown when survey creation fails
    error Quizzler__SurveyCreationFailed();
    /// @notice Thrown when reward payment fails
    error Quizzler__RewardPaymentFailed();
    /// @notice Thrown when the provided Agoric address is invalid
    error Quizzler_InvalidAgoricAddress();

    /// @notice Ensures only managers can call a function
    modifier onlyManager() {
        if (!managers[msg.sender]) revert Quizzler_OnlyManager();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address gateway_, address gasService_, string memory chainName_) AxelarExecutableWithToken(gateway_) {
        _disableInitializers();
        chainName = chainName_;
        gasService = IAxelarGasService(gasService_);
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        managers[msg.sender] = true;
    }

    /// @notice Sets or unsets an address as a manager
    /// @param _manager Address of the manager
    /// @param _status Boolean representing the desired manager status
    function setManager(address _manager, bool _status) external onlyOwner {
        if (_manager == address(0)) revert Quizzler__InvalidManagerAddress();

        managers[_manager] = _status;

        emit UpdateManager(_manager, _status);
    }

    /// @notice Retrieves the amount required to fully fund a survey
    /// @param _surveyId Unique ID of the survey
    /// @return amountToFund The amount of funds required to pay out all potential rewards
    function getSurveyAmountToFund(string memory _surveyId) public view returns (uint256 amountToFund) {
        amountToFund = surveys[_surveyId].participantsLimit * surveys[_surveyId].rewardAmount;
    }

    /// @notice Calculates the total reward amount paid for a specific survey
    /// @param _surveyId Unique ID of the survey
    /// @return amountPayded Total amount of rewards paid to participants
    function getSurveysRewardsAmountPaid(string memory _surveyId) public view returns (uint256 amountPayded) {
        amountPayded = surveys[_surveyId].participantsRewarded * surveys[_surveyId].rewardAmount;
    }

    /// @notice Returns detailed information about a survey
    /// @param _surveyId The unique identifier of the survey
    /// @return surveyCreator The creator of the survey
    /// @return participantsLimit The maximum number of participants allowed
    /// @return rewardAmount The reward amount per participant
    /// @return participantsRewarded The number of participants already rewarded
    /// @return amountToFund The remaining amount needed to fully fund the survey
    /// @return surveyHash The unique hash of the survey for verification
    /// @return isCanceled Whether the survey has been canceled
    function getSurvey(string memory _surveyId)
        external
        view
        returns (
            string memory surveyCreator,
            uint256 participantsLimit,
            uint256 rewardAmount,
            uint256 participantsRewarded,
            uint256 amountToFund,
            bytes32 surveyHash,
            bool isCanceled
        )
    {
        surveyCreator = surveys[_surveyId].surveyCreator;
        participantsLimit = surveys[_surveyId].participantsLimit;
        rewardAmount = surveys[_surveyId].rewardAmount;
        participantsRewarded = surveys[_surveyId].participantsRewarded;
        surveyHash = surveys[_surveyId].surveyHash;
        isCanceled = surveys[_surveyId].isCanceled;
        amountToFund = getSurveyAmountToFund(_surveyId);
    }

    /// @notice Checks if a participant has already claimed their reward for a specific survey
    /// @param _surveyId The unique identifier of the survey
    /// @param _participant The participant's Agoric address
    /// @return bool True if the participant has claimed their reward, false otherwise
    function getHasClaimedReward(string memory _surveyId, string memory _participant) external view returns (bool) {
        return surveysUsersRewarded[_surveyId][_participant];
    }

    /// @notice Generates a proof for survey creating
    /// @param _token Unique token for the transaction
    /// @param _timeToExpire Timestamp until which the proof is valid
    /// @param _owner The creator of the survey
    /// @param _surveyId The survey identifier
    /// @param _participantsLimit The max number of participants allowed
    /// @param _rewardAmount The amount of reward for each participant
    /// @param _surveyHash A unique hash representing the survey
    /// @return message Generated message hash
    function createProof(
        bytes32 _token,
        uint256 _timeToExpire,
        string memory _owner,
        string memory _surveyId,
        uint256 _participantsLimit,
        uint256 _rewardAmount,
        bytes32 _surveyHash
    ) public view returns (bytes32 message) {
        if (proofTokens[_token]) {
            message = bytes32(0);
        } else {
            message = keccak256(
                abi.encodePacked(
                    getChainID(),
                    _token,
                    _timeToExpire,
                    _owner,
                    _surveyId,
                    _participantsLimit,
                    _rewardAmount,
                    _surveyHash
                )
            );
        }
    }

    /// @notice Generates a proof for survey cancellation
    function cancelProof(bytes32 _token, uint256 _timeToExpire, string memory _surveyId)
        public
        view
        returns (bytes32 message)
    {
        if (proofTokens[_token]) {
            message = bytes32(0);
        } else {
            message = keccak256(abi.encodePacked(getChainID(), _token, _timeToExpire, _surveyId));
        }
    }

    /// @notice Generates a proof for rewarding
    function rewardProof(
        bytes32 _token,
        uint256 _timeToExpire,
        string[] memory _surveyIds,
        string[] memory _participantsEncoded
    ) public view returns (bytes32 message) {
        if (proofTokens[_token]) {
            message = bytes32(0);
        } else {
            message = keccak256(
                abi.encodePacked(getChainID(), _token, _timeToExpire, _surveyIds.length, _participantsEncoded.length)
            );
        }
    }

    function _executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
        // Validate Source Chain
        if (keccak256(bytes(sourceChain)) != AGORIC_CHAIN_HASH) revert Quizzler__WrongSource();

        if (amount > 0) revert Quizzler__NoTokens();

        address tokenAddress = gatewayWithToken().tokenAddresses(tokenSymbol);

        uint256 msgId = abi.decode(payload, (uint256));
        if (msgId != CREATE_SURVEY_MSG_ID) revert Quizzler__WrongMsgId();

        if (!_handleCreateSurvey(payload, amount, tokenAddress, tokenSymbol)) revert Quizzler__SurveyCreationFailed();

        emit ExecuteEventCompleted(commandId, msgId);
    }

    function _execute(bytes32 commandId, string calldata sourceChain, string calldata, bytes calldata payload)
        internal
        override
    {
        // Validate Source Chain
        if (keccak256(bytes(sourceChain)) != AGORIC_CHAIN_HASH) revert Quizzler__WrongSource();

        uint256 msgId = abi.decode(payload, (uint256));

        if (msgId == CANCEL_SURVEY_MSG_ID) {
            (, bytes memory _signature, bytes32 _token, uint256 _timeToExpire, string memory _surveyId) =
                abi.decode(payload, (uint256, bytes, bytes32, uint256, string));

            if (!_handleCancelSurvey(sourceChain, _signature, _token, _timeToExpire, _surveyId)) {
                revert Quizzler__SurveyCancelFailed();
            }
        } else if (msgId == PAY_REWARDS_MSG_ID) {
            (
                ,
                bytes memory _signature,
                bytes32 _token,
                uint256 _timeToExpire,
                string[] memory _surveyIds,
                string[] memory _participantsEncoded
            ) = abi.decode(payload, (uint256, bytes, bytes32, uint256, string[], string[]));

            if (!_handleRewardPayment(sourceChain, _signature, _token, _timeToExpire, _surveyIds, _participantsEncoded))
            {
                revert Quizzler__RewardPaymentFailed();
            }
        } else {
            revert Quizzler__WrongMsgId();
        }

        emit ExecuteEventCompleted(commandId, msgId);
    }

    function _handleCreateSurvey(
        bytes calldata payload,
        uint256 amount,
        address tokenAddress,
        string calldata tokenSymbol
    ) internal returns (bool) {
        (
            ,
            bytes memory _signature,
            bytes32 _token,
            uint256 _timeToExpire,
            string memory _owner,
            string memory _surveyId,
            uint256 _participantsLimit,
            uint256 _rewardAmount,
            bytes32 _surveyHash,
        ) = abi.decode(payload, (uint256, bytes, bytes32, uint256, string, string, uint256, uint256, bytes32, uint256));

        // validate the owner address
        if (!validateAddress(_owner)) revert Quizzler_InvalidAgoricAddress();

        bytes32 message =
            createProof(_token, _timeToExpire, _owner, _surveyId, _participantsLimit, _rewardAmount, _surveyHash);

        address signer = preAuthValidations(message, _token, _timeToExpire, _signature);

        if (!managers[signer]) revert Quizzler_InvalidSigner();

        if (surveys[_surveyId].rewardToken != address(0)) revert Quizzler__SurveyExists();

        surveys[_surveyId] = SurveyStruct({
            surveyCreator: _owner,
            participantsLimit: _participantsLimit,
            rewardAmount: _rewardAmount,
            participantsRewarded: 0,
            surveyHash: _surveyHash,
            rewardToken: tokenAddress,
            rewardSymbol: tokenSymbol,
            isCanceled: false
        });

        uint256 amountToSurvey = _participantsLimit * _rewardAmount;

        if (amountToSurvey != amount) revert Quizzler_InvalidRewardAmount();

        emit SurveyCreated(_surveyId, _owner, _participantsLimit, _rewardAmount, _surveyHash);

        return true;
    }

    /// @notice Cancels a survey and refunds the unspent funds
    function _handleCancelSurvey(
        string calldata sourceChain,
        bytes memory _signature,
        bytes32 _token,
        uint256 _timeToExpire,
        string memory _surveyId
    ) internal returns (bool) {
        SurveyStruct storage survey = surveys[_surveyId];

        if (survey.rewardToken == address(0)) {
            revert Quizzler__SurveyDoesNotExist();
        }

        if (survey.isCanceled) revert Quizzler__SurveyAlreadyCanceled();

        if (survey.participantsLimit <= survey.participantsRewarded) {
            revert Quizzler__AllParticipantsRewarded();
        }

        bytes32 message = cancelProof(_token, _timeToExpire, _surveyId);

        address signer = preAuthValidations(message, _token, _timeToExpire, _signature);

        if (!managers[signer]) revert Quizzler_InvalidSigner();

        uint256 returnAmount = getSurveyAmountToFund(_surveyId) - getSurveysRewardsAmountPaid(_surveyId);

        gatewayWithToken().sendToken(sourceChain, survey.surveyCreator, survey.rewardSymbol, returnAmount);

        survey.isCanceled = true;

        emit SurveyCanceled(_surveyId);

        return true;
    }

    /// @notice Distributes rewards to survey participants
    function _handleRewardPayment(
        string calldata sourceChain,
        bytes memory _signature,
        bytes32 _token,
        uint256 _timeToExpire,
        string[] memory _surveyIds,
        string[] memory _participantsEncoded
    ) internal returns (bool) {
        if (_surveyIds.length != _participantsEncoded.length) {
            revert Quizzler__ArrayLengthMismatch();
        }

        bytes32 message = rewardProof(_token, _timeToExpire, _surveyIds, _participantsEncoded);

        address signer = preAuthValidations(message, _token, _timeToExpire, _signature);

        if (!managers[signer]) revert Quizzler_InvalidSigner();

        for (uint256 j = 0; j < _participantsEncoded.length; j++) {
            string memory surveyId = _surveyIds[j];
            SurveyStruct storage survey = surveys[surveyId];

            if (survey.isCanceled) revert Quizzler__SurveyAlreadyCanceled();

            if (survey.participantsRewarded >= survey.participantsLimit) {
                revert Quizzler__AllParticipantsRewarded();
            }

            if (surveysUsersRewarded[surveyId][_participantsEncoded[j]]) revert Quizzler__UserAlreadyRewarded();

            if (!validateAddress(_participantsEncoded[j])) revert Quizzler_InvalidAgoricAddress();

            gatewayWithToken().sendToken(sourceChain, _participantsEncoded[j], survey.rewardSymbol, survey.rewardAmount);

            survey.participantsRewarded++;
            surveysUsersRewarded[surveyId][_participantsEncoded[j]] = true;

            emit RewardPaid(_participantsEncoded[j], surveyId, surveys[surveyId].rewardAmount);

            if (survey.participantsRewarded == survey.participantsLimit) {
                emit SurveyFinished(surveyId);
            }
        }

        return true;
    }

    /// @notice Validates the message and signature
    /// @param _message The message that the user signed
    /// @param _token The unique token for each delegated function
    /// @param _timeToExpire The time to expire the token
    /// @param _signature Signature
    /// @return address Signer of the message
    function preAuthValidations(bytes32 _message, bytes32 _token, uint256 _timeToExpire, bytes memory _signature)
        public
        returns (address)
    {
        if (_message == bytes32(0)) revert Quizzler__InvalidMessageHash();
        if (proofTokens[_token]) revert Quizzler__TokenAlreadyUsed();
        if (block.timestamp > _timeToExpire) revert Quizzler__ProofExpired();

        address signer = getSigner(_message, _signature);
        if (signer == address(0)) revert Quizzler__ZeroAddress();

        proofTokens[_token] = true;

        return signer;
    }

    /// @notice Find the signer
    /// @param message The message that the user signed
    /// @param signature Signature
    /// @return address Signer of the message
    function getSigner(bytes32 message, bytes memory signature) public pure returns (address) {
        message = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(message, signature);
        return signer;
    }

    /// @notice Get the ID of the executing chain
    /// @return uint256 value
    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /// @notice Validates if the address is a valid Agoric address
    /// @param _address The address to validate
    /// @return bool True if the address is valid, false otherwise
    /// @dev This function checks if the address starts with the prefix "agoric"
    function validateAddress(string memory _address) internal pure returns (bool) {
        bytes memory b = bytes(_address);
        bytes memory prefix = bytes("agoric");

        if (b.length < prefix.length) return false;

        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
