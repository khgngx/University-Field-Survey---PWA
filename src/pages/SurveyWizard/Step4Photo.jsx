import PhotoPicker from '../../components/PhotoPicker.jsx'

export default function Step4Photo({ draft, update }) {
  return <PhotoPicker photo={draft.photoBlob} onChange={(photoBlob) => update({ photoBlob })} />
}
