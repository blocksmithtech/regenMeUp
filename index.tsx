import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, GridContainer, GridRow, GridCol, Table, AvatarImage, NumberInputSpinner, FormGroup, TextField, CardValue } from '@taikai/rocket-kit';
import GlobalStyles from './styles/globalStyles'
import { ZkConnectButton, useZkConnect } from "@sismo-core/zk-connect-react";
const { useEffect, useState, useCallback } = React
import { Web3Connection } from '@taikai/dappkit';
import { OnchainVerifier, DailyDrip } from './models/contracts';
import { utils } from 'ethers';
const { getAddress, formatEther } = utils;
import { OnchainVerifierData, DailyDripData } from './models/abi'

const config = {
  appId: "0xa46b780f964ccf1be8e5571ced4ab0bf",
  devMode: {
    enabled: true,
    devAddresses: [
      "0x2E5deB91b444EfbeA95E34BFb9aA043A5F99f567",
      "0x7f7dc3631a1413f8609114cc66c6afdbe24c7e33"
    ]
  }
};

const isValidAddress = (address) => {
  try {
    getAddress(address);
    return true;
  } catch {
    return false;
  }
}

const App = () => {
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isGroupMember, setIsGroupMember] = useState(false);
  const [newRegenPunkAddress, setNewRegenPunkAddress] = useState("");

  const [dripBalance, setDripBalance] = useState('');
  const [dripAmount, setDripAmount] = useState('');
  const [lastDrip, setLastDrip] = useState(new Date());

  const web3Connection = new Web3Connection({ web3Host: "https://goerli.infura.io/v3/d841459c0fca4e8aad16020ddf86f7f7" });
  const [OnchainVerifierContract, setOnchainVerifierContract] = useState(
    new OnchainVerifier(
      web3Connection,
      OnchainVerifierData.abi,
      OnchainVerifierData.address
    )
  );

  useEffect(() => {
    const init = async () => {
      await web3Connection.start();
      await web3Connection.connect();

      await OnchainVerifierContract.start();
      await updateAddresses();

      const dripContract = new DailyDrip(
        web3Connection,
        DailyDripData.abi,
        DailyDripData.address
      )
      await dripContract.start();
      try {
        const balance = await dripContract.getBalance();
      setDripBalance(formatEther(balance).toString())
      } catch {}
      try {
        const dripAmount = await dripContract.getDripAmount();
      setDripAmount(formatEther(dripAmount).toString())
      } catch {}
      try {
        const lastDripTime = await dripContract.lastDripTime();
        setLastDrip(new Date(lastDripTime*1000))
      } catch {}
    }

    init()
      .catch(alert);
  }, []);

  const updateAddresses = useCallback(async () => {
    const pendingAddressesResponse = await OnchainVerifierContract.getPendingAddresses();
    const pendingAddresses = pendingAddressesResponse.reduce((acc, cur) => {
      acc.push({
        id: cur.hash,
        address: cur.addr,
        upvotes: parseInt(cur.upvotes)
      });
      return acc;
    }, []);

    const approvedAddressesResponse = await OnchainVerifierContract.getApprovedAddresses();
    const approvedAddresses = approvedAddressesResponse.reduce((acc, cur) => {
      acc.push({
        id: cur.hash,
        address: cur.addr,
        upvotes: parseInt(cur.upvotes)
      });
      return acc;
    }, pendingAddresses);

    const sortedAddresses = approvedAddresses.sort((a, b) => b.upvotes - a.upvotes)

    console.log(sortedAddresses);
    setGroupMembers(sortedAddresses);
  }, [groupMembers]);

  const onchainVote = useCallback(async (newValue, data) => {
    await updateAddresses();
    try {
      const { upvotes, id } = data;
    
      const response = await OnchainVerifierContract.vote(
        id,
        newValue > upvotes // isUpvote
      );
      console.log(response)
    } catch (error) {
      console.log(error);
      alert(error.message);
    }
    await updateAddresses();
  }, [groupMembers]);

  const { response: ZkConnectResponse } = useZkConnect({ config });
  
  useEffect(() => {
    console.log('ZkConnectResponse', ZkConnectResponse)
    if (!ZkConnectResponse) { return }
    const { verifiableStatements } = ZkConnectResponse
    if (verifiableStatements.findIndex((statement) => statement.groupId === "0x3572d27296a9718a6e5c3274f7076991") >= 0) {
      setIsGroupMember(true)
    }
  }, [ZkConnectResponse]);

  const formSaveAddress = useCallback((event) => {
    console.log(event.target.value)
    setNewRegenPunkAddress(event.target.value)
  }, [newRegenPunkAddress]);

  const registerNewAddress = useCallback(async () => {
    if (!isValidAddress(newRegenPunkAddress)) {
      return alert("Please add a valid address");
    }
    try {
      const response = await OnchainVerifierContract.registerAddress(newRegenPunkAddress);
      console.log(response);
    } catch (error) {
      console.log(error);
      alert(error.message);
    }
    setNewRegenPunkAddress("");
    await updateAddresses();
  }, [newRegenPunkAddress, groupMembers])


  return (
    <>
      <GlobalStyles />
      <GridContainer>
        <GridRow>
          <GridCol size={4}>
            <marquee className="c-marquee" behavior="alternate" direction="down">regenMeUp regenMeUp regenMeUp</marquee>
          </GridCol>
          <GridCol size={4} className="is-third">
            <img src={require("./icon.png")} alt="regenMeUp" style={{ width: '100%' }} />
            <Table
              border
              loadingColumns={4}
              loadingRows={6}
              options={{
                columns: [
                  {
                    className: 'avatar',
                    dataKey: 'address',
                    id: 'address',
                    renderer: (address: string) => (
                      <>
                        <AvatarImage alt={address} boringType="beam" /> <span title={address}>{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
                      </>
                    ),
                    value: 'Address'
                  },
                  {
                    className: 'right',
                    id: 'upvotes',
                    value: 'UpVotes',
                    dataKey: 'upvotes',
                    renderer: (upvotes: number, data: any) => (
                      <div className="c-increase-decrease-input">
                        {isGroupMember ? (
                          <NumberInputSpinner
                            increment={1}
                            onChange={(newValue) => onchainVote(newValue, data)}
                            value={groupMembers.find(m => m.id === data.id).upvotes}
                          />
                        ) : (
                          <span>{upvotes}</span>
                        )}
                      </div>
                    ),
                  }
                ]
              }}
              values={groupMembers}
            />

            <br />
            <br />
            
            {
              isGroupMember && (<>
                <div className="c-card">
                  <FormGroup label="Submit new RegenPunk">
                    <TextField placeholder="0x..." minimal={false} value={newRegenPunkAddress} onChange={formSaveAddress} />
                  </FormGroup>
                  <Button
                    className="button full-width"
                    color="darkGreen"
                    icon="rocket"
                    iconPosition="right"
                    txtColor="white"
                    value="Submit"
                    variant="solid"
                    action={registerNewAddress}
                  />
                </div>
    
                <br />
                <br />
              </>)
            }
            

            <CardValue
              label="Drip Contract Balance"
              value={`${dripBalance} BCT`}
            />
            <br/>
            <p>{`Last Drip: ${lastDrip.toLocaleString()}`}</p>
            <p>{`Drip Amount: ${dripAmount} BCT per vote`}</p>

            <br />
            <br />
          </GridCol>
          <GridCol size={4} className="col-right">
            <ZkConnectButton 
              config={config}
              dataRequest={{
                groupId: "0x3572d27296a9718a6e5c3274f7076991"
              }}
            />
            <p className="sismo-note">Connect via Sismo to vote and register new addresses.</p>
            <marquee className="c-marquee is-flipped" behavior="alternate" direction="down">regenMeUp regenMeUp regenMeUp</marquee>
          </GridCol>
        </GridRow>
      </GridContainer>
    </>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
